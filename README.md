# README.md

# G&M Internal Management Tool

## Overview

G&M Internal Management Tool is a custom-built application designed for managing legal processes within the company. This tool helps streamline the interactions between **lawyers** and **clients**, allowing both roles to manage and track the progression of legal cases, files, and other related tasks in a more efficient and structured manner. 

The application is built with a **role-based system** where users are either clients or lawyers. Clients can view and track the progress of their cases, while lawyers can manage the legal processes, update case statuses, and upload case files.

## Main Features

### 1. **User Management**
   - The **Users** model is at the core of the application and is built around a **role-based system**. Users can either be:
     - **Clients**: Users who have ongoing legal processes and need to track the status of their cases.
     - **Lawyers**: Legal professionals who manage the cases, update statuses, and upload necessary documents.
   - User roles determine what parts of the system the user can access and manage.

### 2. **Process Management**
   - The **Process** model represents the legal cases being handled within the system.
   - Each process can contain several key attributes, such as:
     - **Authority**: The entity managing the case.
     - **Plaintiff** and **Defendant**: The parties involved in the case.
     - **Case Type**: The classification of the legal matter (e.g., Civil, Criminal).
     - **Subcase**: A more specific classification within the case type.
     - **File Number**: A unique identifier for each case.

### 3. **Stage Management**
   - **Processes** can have different **Stages**, representing the current phase of the legal proceedings.
   - Each stage is timestamped, allowing users to track the evolution of the case over time.

### 4. **Case File Management**
   - Each **Process** can have one or more **Case Files** attached to it. These files may include important legal documents, evidence, or other files necessary for the process.
   - Case files can be uploaded by lawyers and viewed by clients, providing a centralized place for managing all relevant documentation.

## Core Models

### 1. **Users**
   The `User` model handles the application’s role-based access system. Users can be either:
   - **Clients**: Users who have cases in the system and can monitor their progress.
   - **Lawyers**: Users who manage the cases, update the status, and upload case files.

### 2. **Processes**
   The `Process` model is the heart of the system, representing the legal cases. It contains essential information such as:
   - **Authority**: The court or legal authority overseeing the case.
   - **Plaintiff** and **Defendant**: The involved parties.
   - **Stage**: A Many-to-Many relationship with the stages, tracking the progress of the case.
   - **Case Files**: A Many-to-Many relationship representing all documents associated with the case.

### 3. **Stages**
   The `Stage` model represents the different stages of the legal process. Each stage can have:
   - **Status**: The current phase of the case (e.g., "Under Investigation", "In Court").
   - **Date Created**: The date the stage was reached.

### 4. **Case Files**
   The `Case File` model handles the files attached to each process. These could include:
   - **File Name**: The name of the file.
   - **Description**: A brief description of the contents of the file.
   - **Date Uploaded**: When the file was uploaded.


## How to Run the Project

## Clone the repository:
```bash
git clone https://github.com/carlos18bp/gym_project.git
cd candle_project
```

## Install virtualenv:
```bash
pip install virtualenv
```

## Create virtual env:
```bash
virtualenv candle_project_env
```

## Activate virtual env:
```bash
source candle_project_env/bin/activate
```

## Install dependencies:
```bash
pip install -r requirements.txt
```

## Desactivate virtual env:
```bash
deactivate
```

## Run makemigrations:
```bash
python3 manage.py makemigrations
```

## Run migrations:
```bash
python3 manage.py migrate
```

## Create superuser:
```bash
python3 manage.py createsuperuser
```

## Create fake data:
```bash
python3 manage.py create_fake_data
```

## Start the server:
```bash
python3 manage.py runserver
```

## Delete fake data:
```bash
python3 manage.py delete_fake_data
```

## Frontend setup:
```bash
cd frontend
npm install
npm run dev
```
