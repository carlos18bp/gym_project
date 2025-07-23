from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.core.mail import EmailMessage
from django.conf import settings
from django.template.loader import get_template
from django.utils.html import strip_tags
from django.template import Context, Template

def send_template_email(template_name: str,
                        subject: str,
                        to_emails: list,
                        context: dict | None = None,
                        attachments: list[str] | None = None,
                        from_email: str | None = None,
                        cc: list[str] | None = None,
                        bcc: list[str] | None = None) -> None:
    """Send an HTML email rendered from a template using the base layout.

    Parameters
    ----------
    template_name : str
        Name of the template. It must match both the folder and the html file that
        live in ``gym_app/templates/emails/<template_name>/<template_name>.html``.
        The template will be injected into the base layout.
    subject : str
        Email subject.
    to_emails : list[str]
        List of recipient addresses.
    context : dict | None, optional
        Context variables injected into the template. Defaults to ``{}``.
    attachments : list[str] | None, optional
        Absolute paths of files to attach. Defaults to ``[]``.
    from_email : str | None, optional
        Custom sender address. If ``None`` the project setting
        ``settings.DEFAULT_FROM_EMAIL`` is used.
    cc : list[str] | None, optional
        CC recipients.
    bcc : list[str] | None, optional
        BCC recipients.

    Raises
    ------
    FileNotFoundError
        If the html template cannot be found.
    Exception
        For any other error while sending the email.
    """
    context = context or {}
    attachments = attachments or []

    # Load the base layout template
    try:
        layout_template = get_template("emails/layout/layout.html")
    except Exception as exc:
        raise FileNotFoundError(
            f"Layout template not found: emails/layout/layout.html. Details: {exc}"
        )

    # Load the specific content template
    content_template_path = f"emails/{template_name}/{template_name}.html"
    try:
        content_template = get_template(content_template_path)
    except Exception as exc:
        raise FileNotFoundError(
            f"Content template not found: {content_template_path}. Details: {exc}"
        )

    # Render the content template
    content_html = content_template.render(context)
    
    # Add the rendered content to context for the layout
    layout_context = context.copy()
    layout_context['content_html'] = content_html
    layout_context['email_title'] = subject

    # Render the final email with layout
    html_content = layout_template.render(layout_context)
    plain_content = strip_tags(html_content)

    email_message = EmailMessage(
        subject=subject,
        body=html_content,
        from_email=from_email or settings.DEFAULT_FROM_EMAIL,
        to=to_emails,
        cc=cc,
        bcc=bcc,
    )
    email_message.content_subtype = "html"  # Indicate HTML body

    # Attach files if provided
    for file_path in attachments:
        try:
            email_message.attach_file(file_path)
        except FileNotFoundError:
            # Skip non-existent files and continue with the rest
            continue

    # Send email
    email_message.send()

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_email_with_attachments(request):
    """
    API endpoint that sends an email rendered from an HTML template and optional
    attachments (authentication required).

    Expected ``request.data`` keys
    -----------------------------
    to_email : str
        Recipient email address (required).
    subject : str
        Email subject. Defaults to *Sin asunto*.
    template_name : str
        Name of the template/folder inside *emails/* (required).
    context : str | dict, optional
        JSON string or dict with context variables for the template.

    Any file sent in ``request.FILES`` will be attached to the outgoing email.
    """
    try:
        to_email = request.data.get('to_email')
        subject = "Envío de documentos solicitados"
        template_name = "send_files"
        context_raw = request.data.get('context', {})

        # Basic validation
        if not to_email:
            return Response({'error': 'El campo "to_email" es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure ``context`` is a dictionary
        if isinstance(context_raw, str):
            try:
                import json
                context = json.loads(context_raw)
            except Exception:
                context = {}
        elif isinstance(context_raw, dict):
            context = context_raw
        else:
            context = {}

        # Store incoming files temporarily so they can be attached to the email
        attachments_paths = []
        for file_key in request.FILES:
            file = request.FILES[file_key]
            from django.core.files.storage import default_storage
            import os
            file_path = default_storage.save(file.name, file)
            full_path = os.path.join(settings.MEDIA_ROOT, file_path)
            attachments_paths.append(full_path)

        # Send the email using the helper function
        send_template_email(
            template_name=template_name,
            subject=subject,
            to_emails=[to_email],
            context=context,
            attachments=attachments_paths
        )

        # Delete temporary files
        import os
        for path in attachments_paths:
            try:
                os.remove(path)
            except OSError:
                pass

        return Response({'message': 'Email sent successfully.'}, status=status.HTTP_200_OK)

    except FileNotFoundError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
