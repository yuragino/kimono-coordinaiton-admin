import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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
    allDetailsOpen: false, // ← 全カード共通の開閉状態をここで持たせる

    async init() {
      await this.fetchItems();
      this.$watch("sort", () => this.updateUrl());
      this.$watch("subFilter", () => this.updateUrl());
    },

    async fetchItems() {
      const snap = await getDocs(collection(db, this.category));
      this.items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.items.forEach(i => this.currentImage[i.id] = 0);
    },

    // ★ カテゴリ切り替え
    changeCategory(cat) {
      this.category = cat;
      this.updateUrl();
      this.fetchItems();
    },

    // ★ ソートやチェックが変わった時URLに反映
    updateUrl() {
      const params = new URLSearchParams();
      params.set("category", this.category);
      if (this.subFilter.length > 0) params.set("subCategory", this.subFilter.join(","));
      params.set("sort", this.sort);
      history.replaceState(null, "", "?" + params.toString());
    },

    // ---- watcher代わりにAlpineの仕組みを使う ----
    // （sortやsubFilterが変わるたびに updateUrl 呼び出し）
    get watchSort() {
      this.updateUrl();
      return this.sort;
    },
    get watchSubFilter() {
      this.updateUrl();
      return this.subFilter;
    },

    // ---- 並べ替え/フィルタ済みデータ ----
    get filteredAndSorted() {
      let arr = [...this.items];

      // フィルタ
      if (this.category !== "浴衣" && this.subFilter.length > 0) {
        arr = arr.filter(i => this.subFilter.includes(i.subCategory));
      }

      // ソート
      if (this.sort === "heightAsc") {
        arr.sort((a, b) => (a.size?.height || 0) - (b.size?.height || 0));
      } else if (this.sort === "heightDesc") {
        arr.sort((a, b) => (b.size?.height || 0) - (a.size?.height || 0));
      } else if (this.sort === "dateDesc") {
        arr.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).reverse();
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
    }
  }));
});