from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication
from .models import CustomUser
from .serializers import ProfileUpdateSerializer, UserSerializer
from rest_framework.authtoken.models import Token

class ProfileAPIView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def get(self, request):
        """GET /profile/ - returns current user profile data"""
        user = request.user
        serializer = UserSerializer(user, context={'request': request})
        return Response(serializer.data)
    
    def patch(self, request):
        """PATCH /profile/ - updates current user profile"""
        user = request.user
        serializer = ProfileUpdateSerializer(user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({
                'message': 'Profile updated successfully.',
                'profile': serializer.data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request):
        """DELETE /profile/ - deactivates current user account"""
        user = request.user
        user.is_active = False
        user.save()
        
        # Delete auth token
        Token.objects.filter(user=user).delete()
        
        return Response({
            'message': 'Account deactivated successfully.'
        }, status=status.HTTP_200_OK)
