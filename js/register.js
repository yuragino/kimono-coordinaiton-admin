import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, doc, getDoc, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOMtAoCObyoalTk6_nVpGlsnLcGSw4Jzc",
  authDomain: "kimono-coordinate.firebaseapp.com",
  projectId: "kimono-coordinate",
  storageBucket: "kimono-coordinate.appspot.com",
  messagingSenderId: "399031825104",
  appId: "1:399031825104:web:46539ee3ede037c45724d5",
  measurementId: "G-ETTRN5YVXN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CLOUDINARY_CONFIG = {
  CLOUD_NAME: 'dxq1xqypx',
  UPLOAD_PRESET: 'unsigned_preset',
};
document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    category: '小紋',
    subCategory: '袷',
    isMiyuki: false,
    height: "",
    backWidth: "",
    yuki: "",
    previews: [],
    files: [],
    isEditMode: false,
    isSubmitting: false,
    docId: new URLSearchParams(location.search).get("id"),

    async init() {
      if (this.docId) {
        this.isEditMode = true;
        const urlCat = new URLSearchParams(location.search).get("category");
        if (urlCat) this.category = urlCat;
        await this.loadData(this.docId);
      }
    },

    handleImageUpload(e) {
      for (let file of e.target.files) {
        this.files.push(file);
        this.previews.push(URL.createObjectURL(file));
      }
    },

    confirmRemoveImage(index) {
      if (confirm("この画像を削除しますか？")) {
        this.removeImage(index);
      }
    },

    removeImage(index) {
      this.files.splice(index, 1);
      URL.revokeObjectURL(this.previews[index]);
      this.previews.splice(index, 1);
    },

    // ✅ ここを追加！
    async uploadImageToCloudinary(file, folderName) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_CONFIG.UPLOAD_PRESET);
      formData.append("folder", folderName);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      return data.secure_url;
    },

    async submitForm() {
      if (!this.category) {
        alert("カテゴリを選択してください");
        return;
      }

      // 寸法バリデーション
      if (!this.height || !this.backWidth || !this.yuki) {
        alert("寸法（身丈・後幅・裄）をすべて入力してください");
        return;
      }

      // 写真バリデーション
      if (this.previews.length === 0) {
        alert("写真を1枚以上選択してください");
        return;
      }

      this.isSubmitting = true;
      try {
        const uploadedUrls = [];
        for (let file of this.files) {
          const url = await this.uploadImageToCloudinary(file, this.category);
          uploadedUrls.push(url);
        }

        const finalUrls = [
          ...this.previews.filter(p => !p.startsWith("blob:")),
          ...uploadedUrls
        ];

        const dataToSave = {
          category: this.category,
          subCategory: this.subCategory,
          isMiyuki: this.isMiyuki,
          size: {
            height: this.height,
            backWidth: this.backWidth,
            yuki: this.yuki
          },
          imageUrls: finalUrls,
          updatedAt: serverTimestamp(),
        };

        if (this.isEditMode) {
          // 元のカテゴリをURLから取得
          const originalCategory = new URLSearchParams(location.search).get("category");

          if (originalCategory === this.category) {
            // ✅ カテゴリが変わってない → update
            await updateDoc(doc(db, this.category, this.docId), dataToSave);
          } else {
            // ✅ カテゴリが変わった → 元をdelete、新カテゴリにadd
            await deleteDoc(doc(db, originalCategory, this.docId));
            dataToSave.createdAt = serverTimestamp();
            await addDoc(collection(db, this.category), dataToSave);
          }
          alert("更新しました");
          location.href = `index.html?category=${this.category}`;
        } else {
          // 新規登録
          dataToSave.createdAt = serverTimestamp();
          await addDoc(collection(db, this.category), dataToSave);
          alert("登録しました");
          this.resetForm();
        }
      } catch (err) {
        console.error(err);
        alert("エラー: " + err.message);
      } finally {
        this.isSubmitting = false;
      }
    },

    async loadData(id) {
      try {
        const docRef = doc(db, this.category, id); // ← categoryを正しく参照
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          this.category = data.category; // DB側の値で上書きしてもOK
          this.subCategory = data.subCategory || "袷";
          this.isMiyuki = !!data.isMiyuki;
          this.height = data.size?.height || "";
          this.backWidth = data.size?.backWidth || "";
          this.yuki = data.size?.yuki || "";
          this.previews = data.imageUrls || [];
        } else {
          console.warn("該当ドキュメントなし");
        }
      } catch (e) {
        console.error("ロード失敗", e);
      }
    },

    resetForm() {
      this.height = "";
      this.backWidth = "";
      this.yuki = "";
      this.files = [];
      this.previews = [];
      this.isEditMode = false;
      this.isSubmitting = false;
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = "";
    },

    handleKeydown(e) {
      if (e.key === "Enter" && e.metaKey) {
        e.preventDefault();
        if (!this.isSubmitting) {
          this.submitForm();
        }
      }
    },
    async deleteItem() {
      if (!this.isEditMode || !this.docId) return;

      if (confirm("本当に削除しますか？")) {
        try {
          await deleteDoc(doc(db, this.category, this.docId));
          alert("削除しました");
          location.href = `index.html?category=${this.category}`; // ✅ 一覧へ戻す
        } catch (e) {
          console.error("削除失敗", e);
          alert("削除に失敗しました: " + e.message);
        }
      }
    }

  }));
});