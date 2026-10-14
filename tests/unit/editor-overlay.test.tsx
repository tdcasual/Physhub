import { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearEditorOverlay,
  overlayStorageKey,
  readEditorOverlay,
  useEditorOverlay,
  useLinkLeaveConfirm,
  writeEditorOverlay,
} from "@/lib/ui/editor-overlay";

function Probe({
  storageKey,
  serverBaseVersion,
  initial,
}: {
  storageKey: string;
  serverBaseVersion: string | number;
  initial: { answer: string };
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const overlay = useEditorOverlay({
    storageKey,
    snapshot,
    serverBaseVersion,
    onHydrate: setSnapshot,
  });
  useLinkLeaveConfirm(overlay.isDirty);

  return (
    <div>
      {overlay.restored ? <p role="status">已恢复未提交的修改</p> : null}
      <input
        aria-label="答案"
        value={snapshot.answer}
        onChange={(event) =>
          setSnapshot({ answer: event.currentTarget.value })
        }
      />
      <button type="button" onClick={() => overlay.markClean(2)}>
        保存修订
      </button>
      <button type="button" onClick={() => overlay.advanceBase(2)}>
        确认版本
      </button>
      {/* Native anchor: leave-confirm listens on click capture of a[href]. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/drafts">工作台</a>
    </div>
  );
}

describe("editor overlay recovery", () => {
  const key = overlayStorageKey("question", "question_1");

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("restores edits after unmount", () => {
    const first = render(
      <Probe storageKey={key} serverBaseVersion={1} initial={{ answer: "A" }} />,
    );

    fireEvent.change(screen.getByLabelText("答案"), { target: { value: "B" } });
    first.unmount();

    render(
      <Probe storageKey={key} serverBaseVersion={1} initial={{ answer: "A" }} />,
    );

    expect(screen.getByLabelText("答案")).toHaveValue("B");
    expect(screen.getByRole("status")).toHaveTextContent("已恢复未提交的修改");
  });

  it("drops overlay when the server version is newer", () => {
    writeEditorOverlay(key, {
      snapshot: { answer: "B" },
      updatedAt: new Date().toISOString(),
      baseVersion: 1,
    });

    render(
      <Probe storageKey={key} serverBaseVersion={2} initial={{ answer: "A" }} />,
    );

    expect(screen.getByLabelText("答案")).toHaveValue("A");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(readEditorOverlay(key)).toBeNull();
  });

  it("clears overlay after a successful save", () => {
    const { unmount } = render(
      <Probe storageKey={key} serverBaseVersion={1} initial={{ answer: "A" }} />,
    );
    fireEvent.change(screen.getByLabelText("答案"), { target: { value: "B" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修订" }));
    expect(readEditorOverlay(key)).toBeNull();
    unmount();
    render(
      <Probe storageKey={key} serverBaseVersion={2} initial={{ answer: "B" }} />,
    );
    expect(screen.getByLabelText("答案")).toHaveValue("B");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("confirms in-app links while dirty and not after clear", () => {
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    render(
      <Probe storageKey={key} serverBaseVersion={1} initial={{ answer: "A" }} />,
    );
    fireEvent.change(screen.getByLabelText("答案"), { target: { value: "B" } });
    const link = screen.getByRole("link", { name: "工作台" });
    const cancelled = fireEvent.click(link);
    expect(confirm).toHaveBeenCalled();
    expect(cancelled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "保存修订" }));
    confirm.mockClear();
    fireEvent.click(link);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("writes overlay on pagehide even without waiting for rAF", () => {
    render(
      <Probe storageKey={key} serverBaseVersion={1} initial={{ answer: "A" }} />,
    );
    fireEvent.change(screen.getByLabelText("答案"), { target: { value: "C" } });
    window.dispatchEvent(new Event("pagehide"));
    expect(readEditorOverlay<{ answer: string }>(key)?.snapshot.answer).toBe(
      "C",
    );
  });

  it("keeps later edits dirty when acknowledging a submitted snapshot", () => {
    function ConcurrentProbe() {
      const [snapshot, setSnapshot] = useState({ answer: "A" });
      const submittedRef = useRef<{ answer: string } | null>(null);
      const overlay = useEditorOverlay({
        storageKey: key,
        snapshot,
        serverBaseVersion: 1,
        onHydrate: setSnapshot,
      });

      return (
        <div>
          <input
            aria-label="答案"
            value={snapshot.answer}
            onChange={(event) =>
              setSnapshot({ answer: event.currentTarget.value })
            }
          />
          <button
            type="button"
            onClick={() => {
              submittedRef.current = snapshot;
            }}
          >
            捕获提交
          </button>
          <button
            type="button"
            onClick={() => {
              overlay.markClean(2, submittedRef.current ?? snapshot);
            }}
          >
            确认提交
          </button>
        </div>
      );
    }

    const first = render(<ConcurrentProbe />);
    fireEvent.change(screen.getByLabelText("答案"), { target: { value: "B" } });
    fireEvent.click(screen.getByRole("button", { name: "捕获提交" }));
    fireEvent.change(screen.getByLabelText("答案"), { target: { value: "C" } });
    fireEvent.click(screen.getByRole("button", { name: "确认提交" }));
    expect(readEditorOverlay<{ answer: string }>(key)?.snapshot.answer).toBe(
      "C",
    );
    expect(readEditorOverlay(key)?.baseVersion).toBe(2);
    first.unmount();
    render(
      <Probe storageKey={key} serverBaseVersion={2} initial={{ answer: "B" }} />,
    );
    expect(screen.getByLabelText("答案")).toHaveValue("C");
    expect(screen.getByRole("status")).toHaveTextContent("已恢复未提交的修改");
  });

  it("advances overlay base so later edits survive a remount", () => {
    const first = render(
      <Probe storageKey={key} serverBaseVersion={1} initial={{ answer: "A" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "确认版本" }));
    fireEvent.change(screen.getByLabelText("答案"), { target: { value: "B" } });
    first.unmount();
    render(
      <Probe storageKey={key} serverBaseVersion={2} initial={{ answer: "A" }} />,
    );
    expect(screen.getByLabelText("答案")).toHaveValue("B");
    expect(screen.getByRole("status")).toHaveTextContent("已恢复未提交的修改");
  });

  it("does not call history.pushState while typing", () => {
    const pushState = vi.spyOn(history, "pushState");
    render(
      <Probe storageKey={key} serverBaseVersion={1} initial={{ answer: "A" }} />,
    );
    fireEvent.change(screen.getByLabelText("答案"), { target: { value: "B" } });
    expect(pushState).not.toHaveBeenCalled();
    pushState.mockRestore();
    clearEditorOverlay(key);
  });
});
