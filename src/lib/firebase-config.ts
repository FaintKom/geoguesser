import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBtn6DxYWuDelDspWpJwSjRFWgQ5F-nXu0",
  authDomain: "geoguesser-f8fc4.firebaseapp.com",
  databaseURL: "https://geoguesser-f8fc4-default-rtdb.firebaseio.com",
  projectId: "geoguesser-f8fc4",
  storageBucket: "geoguesser-f8fc4.firebasestorage.app",
  messagingSenderId: "230757425940",
  appId: "1:230757425940:web:c61bf05265913cf1bf5801",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
