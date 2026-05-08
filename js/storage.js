import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBDO_oFxGkj4rSr8l_DxKwB5IUpqe8FWhw",
  authDomain:        "momonote-b26be.firebaseapp.com",
  projectId:         "momonote-b26be",
  storageBucket:     "momonote-b26be.firebasestorage.app",
  messagingSenderId: "220086826188",
  appId:             "1:220086826188:web:e4e624488c63b61d76be69"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const COL = "eng_posts";

const Storage = {
  async load() {
    const q    = query(collection(db, COL), orderBy("ts", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  },

  async saveOne(post) {
    await setDoc(doc(db, COL, String(post.id)), post);
  },

  async deleteOne(id) {
    await deleteDoc(doc(db, COL, String(id)));
  }
};

export default Storage;