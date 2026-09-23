import { useEffect, useState } from "react";

// В Chrome/Android/десктопе браузер сам присылает это событие, когда
// сайт можно установить — мы его перехватываем и "придерживаем",
// чтобы вызвать по нажатию своей кнопки, а не системной мини-панели.
let deferredPrompt = null;
let listenersAttached = false;

function attachGlobalListener() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new Event("pwa-install-available"));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new Event("pwa-install-available"));
  });
}

attachGlobalListener();

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onAvailable = () => {
      setCanInstall(!!deferredPrompt);
      setInstalled(isStandalone());
    };
    window.addEventListener("pwa-install-available", onAvailable);
    return () => window.removeEventListener("pwa-install-available", onAvailable);
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanInstall(false);
    return outcome === "accepted";
  };

  return {
    canInstall,
    installed,
    isIOS: isIOS(),
    promptInstall,
  };
}
