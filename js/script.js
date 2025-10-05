import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getFirestore, collection, getDocs, updateDoc, doc, Timestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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

document.addEventListener("alpine:init", () => {
  Alpine.data("app", () => ({
    category: new URLSearchParams(location.search).get("category") || "小紋",
    subFilter: (new URLSearchParams(location.search).get("subCategory") || "")
      .split(",").filter(Boolean),
    sort: new URLSearchParams(location.search).get("sort") || "heightAsc",
    items: [],
    currentImage: {},
    isRentalModalOpen: false,
    rentalDate: "",
    rentalTargetItem: null,
    showOnlyRented: false,

    async init() {
      await this.fetchItems();
      this.$watch("sort", () => this.updateUrl());
      this.$watch("subFilter", () => this.updateUrl());
    },

    async fetchItems() {
      const snap = await getDocs(collection(db, this.category));
      this.items = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          rentals: data.rentals || []  // 配列がなければ空に
        };
      });
      this.items.forEach(i => this.currentImage[i.id] = 0);
    },

    changeCategory(cat) {
      this.category = cat;
      this.updateUrl();
      this.fetchItems();
    },

    updateUrl() {
      const params = new URLSearchParams();
      params.set("category", this.category);
      if (this.subFilter.length > 0) params.set("subCategory", this.subFilter.join(","));
      params.set("sort", this.sort);
      history.replaceState(null, "", "?" + params.toString());
    },

    get filteredAndSorted() {
      let arr = [...this.items];
      if (this.category !== "浴衣" && this.subFilter.length > 0) {
        arr = arr.filter(i => this.subFilter.includes(i.subCategory));
      }
      if (this.showOnlyRented) {
        arr = arr.filter(i => i.rentals && i.rentals.length > 0);
      }
      if (this.sort === "heightAsc") {
        arr.sort((a, b) => (a.size?.height || 0) - (b.size?.height || 0));
      } else if (this.sort === "heightDesc") {
        arr.sort((a, b) => (b.size?.height || 0) - (a.size?.height || 0));
      } else if (this.sort === "dateAsc") {
        arr.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      } else if (this.sort === "dateDesc") {
        arr.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      }
      return arr;
    },

    prevImage(id, len) {
      this.currentImage[id] = (this.currentImage[id] - 1 + len) % len;
    },
    nextImage(id, len) {
      this.currentImage[id] = (this.currentImage[id] + 1) % len;
    },

    editItem(item) {
      location.href = `register.html?id=${item.id}&category=${this.category}`;
    },

    // --- モーダル ---
    openRentalModal(item) {
      this.rentalTargetItem = item;
      this.rentalDate = new Date().toISOString().slice(0, 10);
      this.isRentalModalOpen = true;
    },
    closeRentalModal() {
      this.isRentalModalOpen = false;
      this.rentalDate = "";
      this.rentalTargetItem = null;
    },

    // --- 貸出登録（新しい record を rentals 配列に追加して保存） ---
    async submitRental() {
      if (!this.rentalDate) {
        alert("貸出日を入力してください。");
        return;
      }
      const rentalDateObj = new Date(this.rentalDate);
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

      const record = {
        rentalDate: Timestamp.fromDate(rentalDateObj),
        rentalStartDate: Timestamp.fromDate(new Date(rentalDateObj.getTime() - ONE_WEEK_MS)),
        rentalEndDate: Timestamp.fromDate(new Date(rentalDateObj.getTime() + ONE_WEEK_MS)),
      };

      const itemRef = doc(db, this.category, this.rentalTargetItem.id);
      const current = this.rentalTargetItem.rentals || [];
      const updated = [...current, record]; // 既存に追加

      await updateDoc(itemRef, { rentals: updated });

      this.closeRentalModal();
      await this.fetchItems();
    },

    // --- 貸出解除（rentals配列から対象1件を除外して保存） ---
    async cancelRental(item, rentalToDelete) {
      const confirmDelete = confirm("この貸出予約を解除しますか？");
      if (!confirmDelete) return;  // キャンセルなら処理しない

      const itemRef = doc(db, this.category, item.id);
      const current = item.rentals || [];

      const updated = current.filter(r =>
        !(r.rentalDate.seconds === rentalToDelete.rentalDate.seconds &&
          r.rentalStartDate.seconds === rentalToDelete.rentalStartDate.seconds &&
          r.rentalEndDate.seconds === rentalToDelete.rentalEndDate.seconds)
      );

      await updateDoc(itemRef, { rentals: updated });
      await this.fetchItems();
    },

    // --- 日付表示 ---
    // formatDateRange(rental) {
    //   const toDate = d => d?.toDate ? d.toDate() : new Date(d);
    //   const options = { month: "numeric", day: "numeric" };
    //   const startStr = toDate(rental.rentalStartDate).toLocaleDateString("ja-JP", options);
    //   const endStr = toDate(rental.rentalEndDate).toLocaleDateString("ja-JP", options);
    //   return `${startStr} 〜 ${endStr}`;
    // },
    formatDate(date) {
      const d = date?.toDate ? date.toDate() : new Date(date);
      const options = { month: "numeric", day: "numeric" };
      return d.toLocaleDateString("ja-JP", options);
    },

    formatDateRange(start, end) {
      const toDate = d => d?.toDate ? d.toDate() : new Date(d);
      const options = { month: "numeric", day: "numeric" };
      const startStr = toDate(start).toLocaleDateString("ja-JP", options);
      const endStr = toDate(end).toLocaleDateString("ja-JP", options);
      return `${startStr} 〜 ${endStr}`;
    }

  }));
});