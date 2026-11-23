from django.urls import path
from accounts.views import (
    register_user,
    login_user,
    logout_user,
    get_current_user,
    profile_view_or_update,
    upload_profile_photo
)

urlpatterns = [
    # Auth endpoints
    path('auth/register', register_user, name='auth-register'),
    path('auth/login', login_user, name='auth-login'),
    path('auth/logout', logout_user, name='auth-logout'),
    path('auth/me', get_current_user, name='auth-me'),

    # Profile endpoints
    path('profile', profile_view_or_update, name='profile-view-update'),
    path('profile/photo', upload_profile_photo, name='profile-photo-upload'),
]
