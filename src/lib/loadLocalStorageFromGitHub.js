// AplicaciónWebContabilidad2025/src/lib/loadLocalStorageFromGitHub.js
export const loadLocalStorageFromGitHub = async () => {
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/JaiderHertur26/AplicacionWebContabilidad2025/main/CopiaLocalStorage.json"
    );
    const data = await res.json();

    // 2️⃣ Cargar datos en localStorage
    Object.keys(data).forEach((key) => localStorage.setItem(key, data[key]));
    console.log("LocalStorage cargado desde GitHub");
  } catch (error) {
    console.error("Error cargando localStorage desde GitHub:", error);
  }
};
