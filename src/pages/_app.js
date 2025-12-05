// /pages/_app.js
import { useEffect } from "react";
import "../styles/globals.css";
import { bootstrapIfNeeded, syncFromServer } from "../utils/localSync";

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    bootstrapIfNeeded();
    syncFromServer();
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
