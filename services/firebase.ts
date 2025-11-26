// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// THAY THẾ BẰNG CẤU HÌNH CỦA BẠN
const firebaseConfig = {
  apiKey: "AIzaSyDBOddvhLcQL_jB0t9SjJ98WVA9v3yNE-g",
  authDomain: "so-di-buong-211b3.firebaseapp.com",
  projectId: "so-di-buong-211b3",
  storageBucket: "so-di-buong-211b3.firebasestorage.app",
  messagingSenderId: "41386834334",
  appId: "1:41386834334:web:6d29351f12ef3f9ca3be8f",
  measurementId: "G-RRL9JVHM4R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Khởi tạo Cloud Firestore và lấy tham chiếu đến dịch vụ
export const db = getFirestore(app);
