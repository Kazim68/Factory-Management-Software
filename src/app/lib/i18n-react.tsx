import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type AppLanguage,
  getDirectionForLanguage,
  getStoredLanguage,
  setStoredLanguage,
  translateText,
} from "./i18n";

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (value: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const textNodeOriginals = new WeakMap<Text, string>();
const elementOriginals = new WeakMap<Element, Map<string, string>>();
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);

const getTranslatedText = (value: string, language: AppLanguage) =>
  translateText(value, language);

const syncTextOriginal = (node: Text, language: AppLanguage) => {
  const current = node.nodeValue ?? "";
  const storedOriginal = textNodeOriginals.get(node);

  if (storedOriginal == null) {
    textNodeOriginals.set(node, current);
    return current;
  }

  const translatedStored = getTranslatedText(storedOriginal, language);
  const translatedUrdu = getTranslatedText(storedOriginal, "ur");

  if (language === "en") {
    if (current === translatedUrdu) {
      return storedOriginal;
    }

    if (current !== storedOriginal) {
      textNodeOriginals.set(node, current);
      return current;
    }

    return storedOriginal;
  }

  if (current !== storedOriginal && current !== translatedStored) {
    textNodeOriginals.set(node, current);
    return current;
  }

  return storedOriginal;
};

const syncElementOriginal = (
  element: Element,
  attribute: string,
  language: AppLanguage,
) => {
  let originalMap = elementOriginals.get(element);
  if (!originalMap) {
    originalMap = new Map<string, string>();
    elementOriginals.set(element, originalMap);
  }

  const current = element.getAttribute(attribute);
  if (current == null) {
    originalMap.delete(attribute);
    return null;
  }

  const storedOriginal = originalMap.get(attribute);
  if (storedOriginal == null) {
    originalMap.set(attribute, current);
    return current;
  }

  const translatedStored = getTranslatedText(storedOriginal, language);
  const translatedUrdu = getTranslatedText(storedOriginal, "ur");

  if (language === "en") {
    if (current === translatedUrdu) {
      return storedOriginal;
    }

    if (current !== storedOriginal) {
      originalMap.set(attribute, current);
      return current;
    }

    return storedOriginal;
  }

  if (current !== storedOriginal && current !== translatedStored) {
    originalMap.set(attribute, current);
    return current;
  }

  return storedOriginal;
};

const shouldSkipNode = (node: Node) => {
  const parentElement =
    node instanceof Element ? node : node.parentElement ?? null;
  if (!parentElement) return false;
  return SKIP_TAGS.has(parentElement.tagName);
};

const translateTextNode = (node: Text, language: AppLanguage) => {
  if (shouldSkipNode(node)) return;

  const original = syncTextOriginal(node, language);
  const next = translateText(original, language);
  if (node.nodeValue !== next) {
    node.nodeValue = next;
  }
};

const translateElementAttributes = (element: Element, language: AppLanguage) => {
  if (SKIP_TAGS.has(element.tagName)) return;

  for (const attribute of ["placeholder", "title", "aria-label"]) {
    const original = syncElementOriginal(element, attribute, language);
    if (original == null) continue;
    const next = translateText(original, language);
    if (element.getAttribute(attribute) !== next) {
      element.setAttribute(attribute, next);
    }
  }
};

const translateDomTree = (root: ParentNode, language: AppLanguage) => {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );

  let current = walker.currentNode;
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateTextNode(current as Text, language);
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      translateElementAttributes(current as Element, language);
    }
    current = walker.nextNode();
  }
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() =>
    getStoredLanguage(),
  );

  useEffect(() => {
    setStoredLanguage(language);

    const root = document.documentElement;
    root.lang = language === "ur" ? "ur" : "en";
    root.dir = getDirectionForLanguage(language);

    const originalConfirm = window.confirm.bind(window);
    window.confirm = (message?: string) =>
      originalConfirm(
        typeof message === "string" ? translateText(message, language) : message,
      );

    const scheduleTranslate = () => {
      window.requestAnimationFrame(() => {
        if (document.body) {
          translateDomTree(document.body, language);
        }
      });
    };

    scheduleTranslate();

    const observer = new MutationObserver(() => {
      scheduleTranslate();
    });

    if (document.body) {
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["placeholder", "title", "aria-label"],
      });
    }

    return () => {
      observer.disconnect();
      window.confirm = originalConfirm;
    };
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      t: (text: string) => translateText(text, language),
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
