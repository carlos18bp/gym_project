from .views import userAuth, user, case_type, process
from django.urls import path

sign_in_sign_on_urls = [
    path('sign_on/', userAuth.sign_on, name='sign_on'),
    path('sign_on/send_verification_code/', userAuth.send_verification_code, name='send_verification_code'),
    path('sign_in/', userAuth.sign_in, name='sign_in'),
    path('send_passcode/', userAuth.send_passcode, name='send_passcode'),
    path('google_login/', userAuth.google_login, name='google_login'),
    path('update_password/', userAuth.update_password, name='update_password'),    
    path('verify_passcode_and_reset_password/', userAuth.verify_passcode_and_reset_password, name='verify_passcode_and_reset_password'),
]

user_urls = [
    path('users/', user.user_list, name='user-list'),
    path('update_profile/<int:pk>/', user.update_profile, name='update_profile'),
]

process_urls = [
    path('case_types/', case_type.case_list, name='case-list'),
    path('processes/', process.process_list, name='process-list'),
    path('create_process/', process.create_process, name='create-process'),
    path('update_process/<int:pk>/', process.update_process, name='update-process'),
]

urlpatterns = sign_in_sign_on_urls + user_urls + process_urls