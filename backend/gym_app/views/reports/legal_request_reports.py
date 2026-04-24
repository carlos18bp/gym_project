"""
Legal request Excel report generators.
"""
import pandas as pd

from gym_app.models import LegalRequest, LegalRequestType, LegalDiscipline


def generate_received_legal_requests_report(response, start_date, end_datetime):
    """
    Generate report of received legal requests.

    Columns:
    - Nombre Solicitante (LegalRequest.first_name + LegalRequest.last_name)
    - Email (LegalRequest.email)
    - Tipo de Solicitud (LegalRequestType.name)
    - Disciplina Legal (LegalDiscipline.name)
    - Archivos Adjuntos (Count of LegalRequestFiles)
    - Descripción (LegalRequest.description)
    - Fecha de Solicitud (LegalRequest.created_at)
    """
    # Get legal requests created in the date range
    legal_requests = (
        LegalRequest.objects.filter(
            created_at__range=[start_date, end_datetime]
        )
        .select_related('request_type', 'discipline', 'user')
        .prefetch_related('files')
    )

    # Prepare data for Excel
    data = []

    for request in legal_requests:
        # Build requester name and email from related user
        user = getattr(request, "user", None)
        if user is not None:
            requester_name = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
            email = user.email or ""
        else:
            requester_name = ""
            email = ""

        # Count attached files
        file_count = request.files.count()

        # Add request data to the list
        data.append({
            'Nombre Solicitante': requester_name,
            'Email': email,
            'Tipo de Solicitud': request.request_type.name,
            'Disciplina Legal': request.discipline.name,
            'Archivos Adjuntos': file_count,
            'Descripción': request.description,
            'Fecha de Solicitud': request.created_at.date(),
        })

    # Create DataFrame and sort by request date (newest first)
    df = pd.DataFrame(data)
    if not df.empty:
        df = df.sort_values(by=['Fecha de Solicitud'], ascending=False)

    # Create Excel file
    with pd.ExcelWriter(response, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Solicitudes Recibidas', index=False)

        # Get workbook and worksheet objects
        workbook = writer.book
        worksheet = writer.sheets['Solicitudes Recibidas']

        # Add formats
        header_format = workbook.add_format({
            'bold': True,
            'text_wrap': True,
            'valign': 'top',
            'fg_color': '#D9D9D9',
            'border': 1
        })

        wrap_format = workbook.add_format({
            'text_wrap': True,
            'valign': 'top'
        })

        # Write headers with format
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)

            # Set column width based on max length in column
            if not df.empty:
                if value == 'Descripción':
                    # Set a larger width for description column
                    worksheet.set_column(col_num, col_num, 50)
                else:
                    max_len = max(
                        df[value].astype(str).map(len).max(),
                        len(value)
                    ) + 2
                    worksheet.set_column(col_num, col_num, max_len)

        # Apply text wrap format to description column
        if not df.empty:
            desc_col_idx = df.columns.get_loc('Descripción')
            for row_num in range(1, len(df) + 1):
                worksheet.write(row_num, desc_col_idx, df.iloc[row_num-1]['Descripción'], wrap_format)

        # Add summary statistics if there's data
        if not df.empty:
            # Count requests by type
            request_type_counts = df['Tipo de Solicitud'].value_counts().reset_index()
            request_type_counts.columns = ['Tipo de Solicitud', 'Cantidad']

            # Count requests by discipline
            discipline_counts = df['Disciplina Legal'].value_counts().reset_index()
            discipline_counts.columns = ['Disciplina Legal', 'Cantidad']

            # Write request type summary
            summary_row = len(df) + 3  # Leave 2 blank rows after main table
            worksheet.write(summary_row, 0, 'Resumen por Tipo de Solicitud', header_format)

            summary_row += 1
            worksheet.write(summary_row, 0, 'Tipo de Solicitud', header_format)
            worksheet.write(summary_row, 1, 'Cantidad', header_format)

            for idx, row in request_type_counts.iterrows():
                summary_row += 1
                worksheet.write(summary_row, 0, row['Tipo de Solicitud'])
                worksheet.write(summary_row, 1, row['Cantidad'])

            # Write discipline summary
            summary_row += 3  # Add spacing
            worksheet.write(summary_row, 0, 'Resumen por Disciplina Legal', header_format)

            summary_row += 1
            worksheet.write(summary_row, 0, 'Disciplina Legal', header_format)
            worksheet.write(summary_row, 1, 'Cantidad', header_format)

            for idx, row in discipline_counts.iterrows():
                summary_row += 1
                worksheet.write(summary_row, 0, row['Disciplina Legal'])
                worksheet.write(summary_row, 1, row['Cantidad'])

            # Create a new sheet for charts
            chart_sheet = workbook.add_worksheet('Gráficos')

            # Create bar chart for request types
            chart_sheet.write(0, 0, 'Tipo de Solicitud')
            chart_sheet.write(0, 1, 'Cantidad')

            for i, row in enumerate(request_type_counts.values):
                chart_sheet.write(i+1, 0, row[0])
                chart_sheet.write(i+1, 1, row[1])

            type_chart = workbook.add_chart({'type': 'bar'})

            type_chart.add_series({
                'name': 'Solicitudes',
                'categories': ['Gráficos', 1, 0, len(request_type_counts), 0],
                'values': ['Gráficos', 1, 1, len(request_type_counts), 1],
                'fill': {'color': '#5B9BD5'}
            })

            type_chart.set_title({'name': 'Solicitudes por Tipo'})
            type_chart.set_x_axis({'name': 'Tipo de Solicitud'})
            type_chart.set_y_axis({'name': 'Cantidad'})

            chart_sheet.insert_chart('D2', type_chart, {'x_scale': 1.5, 'y_scale': 1.2})

            # Create pie chart for disciplines
            chart_sheet.write(len(request_type_counts) + 3, 0, 'Disciplina Legal')
            chart_sheet.write(len(request_type_counts) + 3, 1, 'Cantidad')

            for i, row in enumerate(discipline_counts.values):
                chart_sheet.write(len(request_type_counts) + 4 + i, 0, row[0])
                chart_sheet.write(len(request_type_counts) + 4 + i, 1, row[1])

            pie_chart = workbook.add_chart({'type': 'pie'})

            pie_chart.add_series({
                'name': 'Disciplinas',
                'categories': ['Gráficos', len(request_type_counts) + 4, 0,
                               len(request_type_counts) + 4 + len(discipline_counts) - 1, 0],
                'values': ['Gráficos', len(request_type_counts) + 4, 1,
                           len(request_type_counts) + 4 + len(discipline_counts) - 1, 1],
                'data_labels': {'percentage': True, 'category': True}
            })

            pie_chart.set_title({'name': 'Distribución por Disciplina Legal'})

            chart_sheet.insert_chart('D18', pie_chart, {'x_scale': 1.5, 'y_scale': 1.2})

    return response


def generate_requests_by_type_discipline_report(response, start_date, end_datetime):
    """
    Generate report of legal requests grouped by type and discipline.

    This report focuses on the analysis and distribution of legal requests based on their
    type and discipline, providing insights on the most common request types and legal areas.

    Sections:
    1. Análisis por Tipo de Solicitud
    2. Análisis por Disciplina Legal
    3. Matriz de Tipo de Solicitud vs Disciplina
    """
    # Get all legal requests in the date range
    legal_requests = LegalRequest.objects.filter(
        created_at__range=[start_date, end_datetime]
    ).select_related('request_type', 'discipline')

    # Get all request types and disciplines for the analysis
    request_types = LegalRequestType.objects.all()
    legal_disciplines = LegalDiscipline.objects.all()

    # Prepare data frames for different analyses
    # 1. Requests by Type
    type_data = []
    for req_type in request_types:
        count = legal_requests.filter(request_type=req_type).count()
        if count > 0:  # Only include types with requests
            type_data.append({
                'Tipo de Solicitud': req_type.name,
                'Cantidad': count,
                'Porcentaje': 0  # Will calculate below if there are requests
            })

    # 2. Requests by Discipline
    discipline_data = []
    for discipline in legal_disciplines:
        count = legal_requests.filter(discipline=discipline).count()
        if count > 0:  # Only include disciplines with requests
            discipline_data.append({
                'Disciplina Legal': discipline.name,
                'Cantidad': count,
                'Porcentaje': 0  # Will calculate below if there are requests
            })

    # 3. Matrix data (Types vs Disciplines)
    matrix_data = []
    for req_type in request_types:
        row_data = {'Tipo de Solicitud': req_type.name}
        for discipline in legal_disciplines:
            count = legal_requests.filter(
                request_type=req_type,
                discipline=discipline
            ).count()
            row_data[discipline.name] = count

        # Only include row if there's at least one request for this type
        if any(row_data.get(discipline.name, 0) > 0 for discipline in legal_disciplines):
            matrix_data.append(row_data)

    # Calculate percentages if there are requests
    total_requests = legal_requests.count()
    if total_requests > 0:
        for item in type_data:
            item['Porcentaje'] = round((item['Cantidad'] / total_requests) * 100, 2)

        for item in discipline_data:
            item['Porcentaje'] = round((item['Cantidad'] / total_requests) * 100, 2)

    # Create DataFrames
    df_types = pd.DataFrame(type_data)
    df_disciplines = pd.DataFrame(discipline_data)
    df_matrix = pd.DataFrame(matrix_data)

    # Sort by quantity (descending)
    if not df_types.empty:
        df_types = df_types.sort_values(by='Cantidad', ascending=False)

    if not df_disciplines.empty:
        df_disciplines = df_disciplines.sort_values(by='Cantidad', ascending=False)

    # Create Excel file with multiple sheets
    with pd.ExcelWriter(response, engine='xlsxwriter') as writer:
        workbook = writer.book

        # 1. Summary sheet with main statistics
        summary_sheet = workbook.add_worksheet('Resumen')

        # Add title
        title_format = workbook.add_format({
            'bold': True,
            'font_size': 16,
            'align': 'center',
            'valign': 'vcenter'
        })
        summary_sheet.merge_range('A1:H1', 'Reporte de Solicitudes por Tipo y Disciplina', title_format)

        # Add date range info
        date_format = workbook.add_format({'bold': True})
        summary_sheet.write('A3', 'Período del reporte:', date_format)
        summary_sheet.write('B3', f'{start_date} al {end_datetime.date()}')

        # Add total requests info
        summary_sheet.write('A5', 'Total de solicitudes:', date_format)
        summary_sheet.write('B5', total_requests)

        # Add types and disciplines count
        summary_sheet.write('A6', 'Tipos de solicitud diferentes:', date_format)
        summary_sheet.write('B6', len(type_data))

        summary_sheet.write('A7', 'Disciplinas legales diferentes:', date_format)
        summary_sheet.write('B7', len(discipline_data))

        # Add mini charts if there's data
        if not df_types.empty and not df_disciplines.empty:
            # Type distribution chart
            type_chart = workbook.add_chart({'type': 'pie'})
            type_rows = min(5, len(df_types))  # Top 5 types or less

            # Write data for chart
            summary_sheet.write('D3', 'Tipo de Solicitud', date_format)
            summary_sheet.write('E3', 'Cantidad', date_format)

            for i in range(type_rows):
                summary_sheet.write(3+i+1, 3, df_types.iloc[i]['Tipo de Solicitud'])
                summary_sheet.write(3+i+1, 4, df_types.iloc[i]['Cantidad'])

            type_chart.add_series({
                'name': 'Distribución por Tipo',
                'categories': ['Resumen', 4, 3, 3+type_rows, 3],
                'values': ['Resumen', 4, 4, 3+type_rows, 4],
                'data_labels': {'percentage': True}
            })

            type_chart.set_title({'name': 'Principales Tipos de Solicitud'})
            summary_sheet.insert_chart('A10', type_chart, {'x_scale': 0.7, 'y_scale': 0.7})

            # Discipline distribution chart
            disc_chart = workbook.add_chart({'type': 'pie'})
            disc_rows = min(5, len(df_disciplines))  # Top 5 disciplines or less

            # Write data for chart
            summary_sheet.write('D10', 'Disciplina Legal', date_format)
            summary_sheet.write('E10', 'Cantidad', date_format)

            for i in range(disc_rows):
                summary_sheet.write(10+i+1, 3, df_disciplines.iloc[i]['Disciplina Legal'])
                summary_sheet.write(10+i+1, 4, df_disciplines.iloc[i]['Cantidad'])

            disc_chart.add_series({
                'name': 'Disciplinas',
                'categories': ['Resumen', 11, 3, 10+disc_rows, 3],
                'values': ['Resumen', 11, 4, 10+disc_rows, 4],
                'data_labels': {'percentage': True, 'category': True}
            })

            disc_chart.set_title({'name': 'Principales Disciplinas Legales'})
            summary_sheet.insert_chart('E10', disc_chart, {'x_scale': 0.7, 'y_scale': 0.7})

        # Add formats
        header_format = workbook.add_format({
            'bold': True,
            'text_wrap': True,
            'valign': 'top',
            'fg_color': '#D9D9D9',
            'border': 1
        })

        # 2. Types Analysis Sheet
        if not df_types.empty:
            df_types.to_excel(writer, sheet_name='Análisis por Tipo', index=False)

            # Get the worksheet
            type_sheet = writer.sheets['Análisis por Tipo']

            # Format headers
            for col_num, value in enumerate(df_types.columns.values):
                type_sheet.write(0, col_num, value, header_format)
                # Set column widths
                if value == 'Tipo de Solicitud':
                    type_sheet.set_column(col_num, col_num, 30)
                else:
                    type_sheet.set_column(col_num, col_num, 15)

            # Add bar chart
            chart = workbook.add_chart({'type': 'column'})

            chart.add_series({
                'name': 'Cantidad',
                'categories': ['Análisis por Tipo', 1, 0, len(df_types), 0],
                'values': ['Análisis por Tipo', 1, 1, len(df_types), 1],
                'fill': {'color': '#5B9BD5'}
            })

            chart.set_title({'name': 'Solicitudes por Tipo'})
            chart.set_x_axis({'name': 'Tipo de Solicitud'})
            chart.set_y_axis({'name': 'Cantidad'})

            # Place the chart below the data
            type_sheet.insert_chart(f'A{len(df_types) + 3}', chart, {'x_scale': 1.5, 'y_scale': 1})

        # 3. Disciplines Analysis Sheet
        if not df_disciplines.empty:
            df_disciplines.to_excel(writer, sheet_name='Análisis por Disciplina', index=False)

            # Get the worksheet
            discipline_sheet = writer.sheets['Análisis por Disciplina']

            # Format headers
            for col_num, value in enumerate(df_disciplines.columns.values):
                discipline_sheet.write(0, col_num, value, header_format)
                # Set column widths
                if value == 'Disciplina Legal':
                    discipline_sheet.set_column(col_num, col_num, 30)
                else:
                    discipline_sheet.set_column(col_num, col_num, 15)

            # Add bar chart
            chart = workbook.add_chart({'type': 'column'})

            chart.add_series({
                'name': 'Cantidad',
                'categories': ['Análisis por Disciplina', 1, 0, len(df_disciplines), 0],
                'values': ['Análisis por Disciplina', 1, 1, len(df_disciplines), 1],
                'fill': {'color': '#70AD47'}
            })

            chart.set_title({'name': 'Solicitudes por Disciplina Legal'})
            chart.set_x_axis({'name': 'Disciplina Legal'})
            chart.set_y_axis({'name': 'Cantidad'})

            # Place the chart below the data
            discipline_sheet.insert_chart(f'A{len(df_disciplines) + 3}', chart, {'x_scale': 1.5, 'y_scale': 1})

        # 4. Matrix Analysis Sheet (Types vs Disciplines)
        if not df_matrix.empty:
            df_matrix.to_excel(writer, sheet_name='Matriz Tipo-Disciplina', index=False)

            # Get the worksheet
            matrix_sheet = writer.sheets['Matriz Tipo-Disciplina']

            # Set header formats
            for col_num, value in enumerate(df_matrix.columns.values):
                matrix_sheet.write(0, col_num, value, header_format)
                matrix_sheet.set_column(col_num, col_num, 15)

            # Add heat map formatting (conditional formatting)
            # First find the maximum value in the matrix for scaling
            numeric_cols = [col for col in df_matrix.columns if col != 'Tipo de Solicitud']
            if numeric_cols:
                max_value = df_matrix[numeric_cols].max().max()

                # Add a color scale (heat map)
                if max_value > 0:
                    # Apply to all cells except the first column (type names)
                    for col_idx, col in enumerate(numeric_cols, start=1):
                        # We add 1 to row_idx to account for the header row
                        for row_idx in range(len(df_matrix)):
                            cell_value = df_matrix.iloc[row_idx][col]

                            # Skip zeros
                            if cell_value == 0:
                                continue

                            # Calculate intensity (0-255) based on the value
                            intensity = min(255, int(180 * cell_value / max_value) + 50)
                            # Convert to hex color (from light to dark blue)
                            r = 255 - intensity
                            g = 255 - intensity
                            b = 255
                            color = f'#{r:02X}{g:02X}{b:02X}'

                            # Create a format for this cell
                            cell_format = workbook.add_format({
                                'bg_color': color,
                                'align': 'center'
                            })

                            # Apply the format to the cell
                            matrix_sheet.write(row_idx + 1, col_idx, cell_value, cell_format)

            # Add a heatmap chart if there's enough data
            if len(df_matrix) > 1 and len(numeric_cols) > 1:  # pragma: no cover – xlsxwriter has no 'heatmap' chart type
                chart = workbook.add_chart({'type': 'heatmap'})

                chart.add_series({
                    'categories': ['Matriz Tipo-Disciplina', 0, 1, 0, len(numeric_cols)],
                    'values': ['Matriz Tipo-Disciplina', 1, 1, len(df_matrix), len(numeric_cols)],
                    'name': 'Distribución',
                    'data_labels': {'value': True}
                })

                chart.set_title({'name': 'Mapa de Calor: Tipo vs Disciplina'})
                chart.set_x_axis({'name': 'Disciplina Legal'})
                chart.set_y_axis({'name': 'Tipo de Solicitud'})

                # Place the chart below the data
                matrix_sheet.insert_chart(f'A{len(df_matrix) + 3}', chart, {'x_scale': 1.5, 'y_scale': 1.5})

        # 5. List of requests with type and discipline
        detailed_data = []
        for request in legal_requests:
            user = getattr(request, "user", None)
            if user is not None:
                requester_name = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
                email = user.email or ""
            else:
                requester_name = ""
                email = ""

            detailed_data.append({
                'Nombre Solicitante': requester_name,
                'Email': email,
                'Tipo de Solicitud': request.request_type.name,
                'Disciplina Legal': request.discipline.name,
                'Archivos Adjuntos': request.files.count(),
                'Fecha de Solicitud': request.created_at.date(),
            })

        if detailed_data:
            df_details = pd.DataFrame(detailed_data)
            df_details = df_details.sort_values(by=['Tipo de Solicitud', 'Disciplina Legal', 'Fecha de Solicitud'])
            df_details.to_excel(writer, sheet_name='Detalle de Solicitudes', index=False)

            # Format the details sheet
            details_sheet = writer.sheets['Detalle de Solicitudes']

            for col_num, value in enumerate(df_details.columns.values):
                details_sheet.write(0, col_num, value, header_format)
                # Set column widths based on content
                max_len = max(
                    df_details[value].astype(str).map(len).max(),
                    len(value)
                ) + 2
                details_sheet.set_column(col_num, col_num, min(max_len, 30))  # Cap at 30

    return response
