"""
Process-related Excel report generators.
"""
import datetime
import pandas as pd

from gym_app.models import Process, Case, Stage, User
from gym_app.views.reports import _get_user_id


def generate_active_processes_report(response, start_date, end_datetime):
    """
    Generate report of active processes with detailed information.

    Columns:
    - Referencia (Process.ref)
    - Tipo de Caso (Case.type)
    - Subcaso (Process.subcase)
    - Cliente (User.first_name + User.last_name)
    - Abogado Asignado (User.first_name + User.last_name)
    - Autoridad (Process.authority)
    - Demandante (Process.plaintiff)
    - Demandado (Process.defendant)
    - Etapa Actual (Stage.status del último registro)
    - Fecha de Creación (Process.created_at)
    - Días Activo (calculado)
    """
    # Base queryset with appropriate filtering
    processes = Process.objects.filter(
        created_at__range=[start_date, end_datetime]
    ).prefetch_related(
        'stages', 'clients', 'lawyer', 'case'
    )

    # Prepare data for Excel
    data = []
    today = datetime.date.today()

    for process in processes:
        # Get the latest stage (assuming stages are ordered by created_at)
        latest_stage = process.stages.order_by('-created_at').first()
        current_stage = latest_stage.status if latest_stage else "Sin etapa"

        # Calculate days active
        created_date = process.created_at.date()
        days_active = (today - created_date).days

        # Client and lawyer names (use the first associated client if any)
        primary_client = next(iter(process.clients.all()), None)
        client_name = f"{(primary_client.first_name or '') if primary_client else ''} {(primary_client.last_name or '') if primary_client else ''}".strip()
        lawyer_name = f"{process.lawyer.first_name or ''} {process.lawyer.last_name or ''}".strip()

        # Add process data to the list
        data.append({
            'Referencia': process.ref,
            'Tipo de Caso': process.case.type,
            'Subcaso': process.subcase,
            'Cliente': client_name,
            'Abogado Asignado': lawyer_name,
            'Autoridad': process.authority,
            'Demandante': process.plaintiff,
            'Demandado': process.defendant,
            'Etapa Actual': current_stage,
            'Fecha de Creación': created_date,
            'Días Activo': days_active
        })

    # Create DataFrame from data
    df = pd.DataFrame(data)

    # Create Excel file
    with pd.ExcelWriter(response, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Procesos Activos', index=False)

        # Get workbook and worksheet objects
        workbook = writer.book
        worksheet = writer.sheets['Procesos Activos']

        # Add formats
        header_format = workbook.add_format({
            'bold': True,
            'text_wrap': True,
            'valign': 'top',
            'fg_color': '#D9D9D9',
            'border': 1
        })

        # Write headers with format
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
            # Set column width based on max length in column
            if not df.empty:
                max_len = max(
                    df[value].astype(str).map(len).max(),
                    len(value)
                ) + 2
                worksheet.set_column(col_num, col_num, max_len)

    return response


def generate_processes_by_lawyer_report(response, start_date, end_datetime):
    """
    Generate report of processes grouped by lawyer.

    Columns:
    - Abogado (User.first_name + User.last_name + User.email)
    - Referencia de Proceso (Process.ref)
    - Tipo de Caso (Case.type)
    - Cliente (User.first_name + User.last_name)
    - Etapa Actual (Stage.status)
    - Fecha de Creación (Process.created_at)
    - Días Activo (calculado)
    """
    # Filter lawyers if a specific user_id is provided
    user_id = _get_user_id()
    if user_id:
        lawyers = User.objects.filter(id=user_id, role='lawyer')
    else:
        lawyers = User.objects.filter(role='lawyer')

    # Prepare data for Excel
    data = []
    today = datetime.date.today()

    for lawyer in lawyers:
        # Get all processes for this lawyer
        processes = Process.objects.filter(
            lawyer=lawyer,
            created_at__range=[start_date, end_datetime]
        ).prefetch_related('stages', 'clients', 'case')

        # Skip lawyers with no processes in the date range
        if not processes.exists():
            continue

        # Build lawyer name and info
        lawyer_name = f"{lawyer.first_name or ''} {lawyer.last_name or ''}".strip()
        lawyer_info = f"{lawyer_name} ({lawyer.email})"

        for process in processes:
            # Get latest stage
            latest_stage = process.stages.order_by('-created_at').first()
            current_stage = latest_stage.status if latest_stage else "Sin etapa"

            # Calculate days active
            created_date = process.created_at.date()
            days_active = (today - created_date).days

            # Client name (use the first associated client if any)
            primary_client = next(iter(process.clients.all()), None)
            client_name = f"{(primary_client.first_name or '') if primary_client else ''} {(primary_client.last_name or '') if primary_client else ''}".strip()

            # Add row to data
            data.append({
                'Abogado': lawyer_info,
                'Referencia de Proceso': process.ref,
                'Tipo de Caso': process.case.type,
                'Cliente': client_name,
                'Etapa Actual': current_stage,
                'Fecha de Creación': created_date,
                'Días Activo': days_active
            })

    # Create DataFrame and sort by lawyer and creation date
    df = pd.DataFrame(data)
    if not df.empty:
        df = df.sort_values(by=['Abogado', 'Fecha de Creación'])

    # Create Excel file
    with pd.ExcelWriter(response, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Procesos por Abogado', index=False)

        # Get workbook and worksheet objects
        workbook = writer.book
        worksheet = writer.sheets['Procesos por Abogado']

        # Add formats
        header_format = workbook.add_format({
            'bold': True,
            'text_wrap': True,
            'valign': 'top',
            'fg_color': '#D9D9D9',
            'border': 1
        })

        # Add summary table format
        summary_format = workbook.add_format({
            'bold': True,
            'bg_color': '#F0F0F0',
            'border': 1
        })

        # Write headers with format
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
            # Set column width based on max length in column
            if not df.empty:
                max_len = max(
                    df[value].astype(str).map(len).max(),
                    len(value)
                ) + 2
                worksheet.set_column(col_num, col_num, max_len)

        # Add summary table if dataframe is not empty
        if not df.empty:
            # Count processes by lawyer and create summary table
            summary_df = df.groupby('Abogado').size().reset_index(name='Total de Procesos')

            # Write summary table
            summary_row = len(df) + 3  # Leave 2 blank rows after main table
            worksheet.write(summary_row, 0, 'Resumen por Abogado', summary_format)
            worksheet.write(summary_row, 1, '', summary_format)

            summary_row += 1
            worksheet.write(summary_row, 0, 'Abogado', summary_format)
            worksheet.write(summary_row, 1, 'Total de Procesos', summary_format)

            for idx, row in summary_df.iterrows():
                summary_row += 1
                worksheet.write(summary_row, 0, row['Abogado'])
                worksheet.write(summary_row, 1, row['Total de Procesos'])

    return response


def generate_processes_by_client_report(response, start_date, end_datetime):
    """
    Generate report of processes grouped by client.

    Columns:
    - Cliente (User.first_name + User.last_name)
    - ID Cliente (User.identification)
    - Tipo de Documento (User.document_type)
    - Referencia de Proceso (Process.ref)
    - Tipo de Caso (Case.type)
    - Abogado Asignado (User.first_name + User.last_name)
    - Etapa Actual (Stage.status)
    - Fecha de Creación (Process.created_at)
    """
    # Filter clients if a specific user_id is provided
    user_id = _get_user_id()
    if user_id:
        clients = User.objects.filter(id=user_id, role='client')
    else:
        clients = User.objects.filter(role='client')

    # Prepare data for Excel
    data = []

    for client in clients:
        # Get all processes for this client
        processes = Process.objects.filter(
            clients=client,
            created_at__range=[start_date, end_datetime]
        ).prefetch_related('stages', 'lawyer', 'case')

        # Skip clients with no processes in the date range
        if not processes.exists():
            continue

        # Build client name and info
        client_name = f"{client.first_name or ''} {client.last_name or ''}".strip()
        client_id = client.identification or "No disponible"
        doc_type = client.document_type or "No especificado"

        for process in processes:
            # Get latest stage
            latest_stage = process.stages.order_by('-created_at').first()
            current_stage = latest_stage.status if latest_stage else "Sin etapa"

            # Get lawyer name
            lawyer_name = f"{process.lawyer.first_name or ''} {process.lawyer.last_name or ''}".strip()

            # Add row to data
            data.append({
                'Cliente': client_name,
                'ID Cliente': client_id,
                'Tipo de Documento': doc_type,
                'Referencia de Proceso': process.ref,
                'Tipo de Caso': process.case.type,
                'Abogado Asignado': lawyer_name,
                'Etapa Actual': current_stage,
                'Fecha de Creación': process.created_at.date()
            })

    # Create DataFrame and sort by client and creation date
    df = pd.DataFrame(data)
    if not df.empty:
        df = df.sort_values(by=['Cliente', 'Fecha de Creación'])

    # Create Excel file
    with pd.ExcelWriter(response, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Procesos por Cliente', index=False)

        # Get workbook and worksheet objects
        workbook = writer.book
        worksheet = writer.sheets['Procesos por Cliente']

        # Add formats
        header_format = workbook.add_format({
            'bold': True,
            'text_wrap': True,
            'valign': 'top',
            'fg_color': '#D9D9D9',
            'border': 1
        })

        # Add summary table format
        summary_format = workbook.add_format({
            'bold': True,
            'bg_color': '#F0F0F0',
            'border': 1
        })

        # Write headers with format
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
            # Set column width based on max length in column
            if not df.empty:
                max_len = max(
                    df[value].astype(str).map(len).max(),
                    len(value)
                ) + 2
                worksheet.set_column(col_num, col_num, max_len)

        # Add summary table if dataframe is not empty
        if not df.empty:
            # Count processes by client and create summary table
            summary_df = df.groupby(['Cliente', 'ID Cliente', 'Tipo de Documento']).size().reset_index(name='Total de Procesos')

            # Write summary table
            summary_row = len(df) + 3  # Leave 2 blank rows after main table
            worksheet.write(summary_row, 0, 'Resumen por Cliente', summary_format)
            worksheet.write(summary_row, 1, '', summary_format)
            worksheet.write(summary_row, 2, '', summary_format)
            worksheet.write(summary_row, 3, '', summary_format)

            summary_row += 1
            worksheet.write(summary_row, 0, 'Cliente', summary_format)
            worksheet.write(summary_row, 1, 'ID Cliente', summary_format)
            worksheet.write(summary_row, 2, 'Tipo de Documento', summary_format)
            worksheet.write(summary_row, 3, 'Total de Procesos', summary_format)

            for idx, row in summary_df.iterrows():
                summary_row += 1
                worksheet.write(summary_row, 0, row['Cliente'])
                worksheet.write(summary_row, 1, row['ID Cliente'])
                worksheet.write(summary_row, 2, row['Tipo de Documento'])
                worksheet.write(summary_row, 3, row['Total de Procesos'])

    return response


def generate_process_stages_report(response, start_date, end_datetime):
    """
    Generate report of process stages with duration information.

    Columns:
    - Referencia de Proceso (Process.ref)
    - Etapa (Stage.status)
    - Fecha de Inicio de Etapa (Stage.created_at)
    - Duración en Días (calculado)
    - Abogado Responsable (User.first_name + User.last_name)
    """
    # Base query to get processes in the date range
    processes_query = Process.objects.filter(
        created_at__range=[start_date, end_datetime]
    )

    # Prefetch related objects to optimize queries
    processes = processes_query.prefetch_related('stages', 'lawyer')

    # Prepare data for Excel
    data = []
    today = datetime.date.today()

    for process in processes:
        # Skip processes with no stages
        if not process.stages.exists():
            continue

        # Get all stages for the process ordered by created_at
        stages = process.stages.all().order_by('created_at')
        lawyer_name = f"{process.lawyer.first_name or ''} {process.lawyer.last_name or ''}".strip()

        # Calculate stage durations
        for i, stage in enumerate(stages):
            # Start date of the stage
            stage_start_date = stage.created_at.date()

            # End date is the start date of the next stage or today
            if i < len(stages) - 1:
                next_stage = stages[i + 1]
                stage_end_date = next_stage.created_at.date()
                is_current = False
            else:
                stage_end_date = today
                is_current = True

            # Calculate duration
            duration_days = (stage_end_date - stage_start_date).days

            # Add to data
            data.append({
                'Referencia de Proceso': process.ref,
                'Etapa': stage.status,
                'Fecha de Inicio': stage_start_date,
                'Fecha de Fin': stage_end_date if not is_current else "Actual",
                'Duración en Días': duration_days,
                'Abogado Responsable': lawyer_name,
                'Etapa Actual': is_current
            })

    # Create DataFrame and sort by process reference and stage start date
    df = pd.DataFrame(data)
    if not df.empty:
        df = df.sort_values(by=['Referencia de Proceso', 'Fecha de Inicio'])

    # Create Excel file
    with pd.ExcelWriter(response, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Etapas de Procesos', index=False)

        # Get workbook and worksheet objects
        workbook = writer.book
        worksheet = writer.sheets['Etapas de Procesos']

        # Add formats
        header_format = workbook.add_format({
            'bold': True,
            'text_wrap': True,
            'valign': 'top',
            'fg_color': '#D9D9D9',
            'border': 1
        })

        current_stage_format = workbook.add_format({
            'bg_color': '#E8F4FF',  # Light blue background
        })

        # Write headers with format
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
            # Set column width based on max length in column
            if not df.empty:
                max_len = max(
                    df[value].astype(str).map(len).max(),
                    len(value)
                ) + 2
                worksheet.set_column(col_num, col_num, max_len)

        # Apply conditional formatting for current stages
        if not df.empty:
            for row_num, row in enumerate(df.values, start=1):
                # Check if this is a current stage (last column is True)
                if row[-1]:  # Last column is 'Etapa Actual'
                    for col_num in range(len(row) - 1):  # Exclude the 'Etapa Actual' column
                        worksheet.write(row_num, col_num, row[col_num], current_stage_format)
                else:
                    for col_num in range(len(row) - 1):
                        worksheet.write(row_num, col_num, row[col_num])

            # Hide the 'Etapa Actual' column as it's just used for formatting
            worksheet.set_column(len(df.columns) - 1, len(df.columns) - 1, None, None, {'hidden': True})

        # Add summary statistics
        if not df.empty:
            # Calculate average duration by stage type
            avg_duration_by_stage = df.groupby('Etapa')['Duración en Días'].mean().reset_index()
            avg_duration_by_stage.columns = ['Etapa', 'Duración Promedio (días)']

            # Write summary statistics
            summary_row = len(df) + 3  # Leave 2 blank rows after main table
            worksheet.write(summary_row, 0, 'Duración Promedio por Etapa', header_format)

            summary_row += 1
            worksheet.write(summary_row, 0, 'Etapa', header_format)
            worksheet.write(summary_row, 1, 'Duración Promedio (días)', header_format)

            for idx, row in avg_duration_by_stage.iterrows():
                summary_row += 1
                worksheet.write(summary_row, 0, row['Etapa'])
                worksheet.write(summary_row, 1, round(row['Duración Promedio (días)'], 1))

    return response
