"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

export type EditorOverlayRecord<T> = {
  snapshot: T;
  updatedAt: string;
  baseVersion: string | number;
};

export function overlayStorageKey(
  kind: "draft" | "question" | "new",
  id: string,
) {
  return `physhub:overlay:${kind}:${id}`;
}

export function readEditorOverlay<T>(key: string): EditorOverlayRecord<T> | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("snapshot" in parsed) ||
      !("baseVersion" in parsed)
    ) {
      return null;
    }

    return parsed as EditorOverlayRecord<T>;
  } catch {
    return null;
  }
}

export function writeEditorOverlay<T>(
  key: string,
  record: EditorOverlayRecord<T>,
): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Quota or blocked storage must not throw out of save/unmount.
  }
}

export function clearEditorOverlay(key: string): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(key);
  } catch {
    // Same as write: persistence is best-effort.
  }
}

function sameVersion(left: string | number, right: string | number) {
  return String(left) === String(right);
}

export function useEditorOverlay<T>({
  storageKey,
  snapshot,
  serverBaseVersion,
  onHydrate,
}: {
  storageKey: string;
  snapshot: T;
  serverBaseVersion: string | number;
  onHydrate: (snapshot: T) => void;
}) {
  const [restored, setRestored] = useState(false);
  const [cleanSerialized, setCleanSerialized] = useState(() =>
    JSON.stringify(snapshot),
  );
  const [baseVersion, setBaseVersion] = useState(serverBaseVersion);
  const snapshotRef = useRef(snapshot);
  const baseVersionRef = useRef(baseVersion);
  const cleanSerializedRef = useRef(cleanSerialized);
  const hydratedRef = useRef(false);

  useLayoutEffect(() => {
    snapshotRef.current = snapshot;
    baseVersionRef.current = baseVersion;
    cleanSerializedRef.current = cleanSerialized;
  });

  const serialized = JSON.stringify(snapshot);
  const isDirty = serialized !== cleanSerialized;

  const flush = useCallback(() => {
    if (JSON.stringify(snapshotRef.current) === cleanSerializedRef.current) {
      return;
    }

    writeEditorOverlay(storageKey, {
      snapshot: snapshotRef.current,
      updatedAt: new Date().toISOString(),
      baseVersion: baseVersionRef.current,
    });
  }, [storageKey]);

  useLayoutEffect(() => {
    if (hydratedRef.current) {
      return;
    }

    hydratedRef.current = true;
    const overlay = readEditorOverlay<T>(storageKey);

    if (!overlay) {
      return;
    }

    if (!sameVersion(overlay.baseVersion, serverBaseVersion)) {
      clearEditorOverlay(storageKey);
      return;
    }

    onHydrate(overlay.snapshot);
    // Mount-only restore of a persisted overlay; not an external store subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate once from sessionStorage
    setRestored(true);
  }, [onHydrate, serverBaseVersion, storageKey]);

  useEffect(() => {
    if (!hydratedRef.current || !isDirty) {
      return;
    }

    writeEditorOverlay(storageKey, {
      snapshot,
      updatedAt: new Date().toISOString(),
      baseVersion: baseVersionRef.current,
    });
  }, [baseVersion, isDirty, snapshot, storageKey]);

  useEffect(() => {
    function onPageHide() {
      flush();
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        flush();
      }
    }

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      flush();
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flush]);

  function markClean(nextBaseVersion?: string | number, acknowledged?: T) {
    const submitted = acknowledged !== undefined ? acknowledged : snapshotRef.current;
    const nextSerialized = JSON.stringify(submitted);
    const nextVersion =
      nextBaseVersion !== undefined ? nextBaseVersion : baseVersionRef.current;
    const leftoverSerialized = JSON.stringify(snapshotRef.current);
    const leftover = leftoverSerialized !== nextSerialized;

    setCleanSerialized(nextSerialized);
    cleanSerializedRef.current = nextSerialized;
    setRestored(false);

    if (nextBaseVersion !== undefined) {
      setBaseVersion(nextBaseVersion);
      baseVersionRef.current = nextBaseVersion;
    }

    if (leftover) {
      writeEditorOverlay(storageKey, {
        snapshot: snapshotRef.current,
        updatedAt: new Date().toISOString(),
        baseVersion: nextVersion,
      });
    } else {
      clearEditorOverlay(storageKey);
    }

    return leftover;
  }

  function advanceBase(nextBaseVersion: string | number) {
    setBaseVersion(nextBaseVersion);
    baseVersionRef.current = nextBaseVersion;

    if (JSON.stringify(snapshotRef.current) === cleanSerializedRef.current) {
      return;
    }

    writeEditorOverlay(storageKey, {
      snapshot: snapshotRef.current,
      updatedAt: new Date().toISOString(),
      baseVersion: nextBaseVersion,
    });
  }

  return { restored, isDirty, markClean, advanceBase, flush };
}

export function useLinkLeaveConfirm(isDirty: boolean) {
  const dirtyRef: MutableRefObject<boolean> = useRef(isDirty);

  useLayoutEffect(() => {
    dirtyRef.current = isDirty;
  });

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!dirtyRef.current) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;

      if (!anchor) {
        return;
      }

      if (
        anchor.target === "_blank" ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const href = anchor.getAttribute("href");

      if (!href || href.startsWith("#")) {
        return;
      }

      if (!window.confirm("有未保存的修改，确定离开？")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);
}
