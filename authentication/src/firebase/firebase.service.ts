import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService {
  private firebaseApp: App;

  constructor() {
    // Read the service account config from environment variables
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccount) {
      console.warn('FIREBASE_SERVICE_ACCOUNT_JSON is not set in the environment.');
      // Fallback for initializing without explicit credentials
      this.firebaseApp = initializeApp();
    } else {
      try {
        const credentials = JSON.parse(serviceAccount);
        this.firebaseApp = initializeApp({
          credential: cert(credentials),
        });
      } catch (e) {
        throw new InternalServerErrorException('Failed to parse Firebase credentials');
      }
    }
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    try {
      return await getAuth(this.firebaseApp).verifyIdToken(idToken);
    } catch (error) {
      throw new Error('Invalid Firebase token');
    }
  }
}

