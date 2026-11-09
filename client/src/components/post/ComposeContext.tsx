import { createContext, useContext, useState, type ReactNode } from "react";
import { Modal } from "../shared/Modal";
import { Composer } from "./Composer";
import type { Post } from "../../types";

interface ComposeOptions {
  parentPostId?: string;
  quotedPost?: Post;
}

interface ComposeContextValue {
  openCompose: (options?: ComposeOptions) => void;
}

const ComposeContext = createContext<ComposeContextValue | undefined>(undefined);

export function ComposeProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ComposeOptions | null>(null);

  return (
    <ComposeContext.Provider value={{ openCompose: (opts) => setOptions(opts || {}) }}>
      {children}
      <Modal
        open={!!options}
        onClose={() => setOptions(null)}
        title={options?.parentPostId ? "Reply" : options?.quotedPost ? "Quote post" : "New post"}
      >
        {options && (
          <Composer
            parentPostId={options.parentPostId}
            quotedPost={options.quotedPost}
            onDone={() => setOptions(null)}
            bordered={false}
          />
        )}
      </Modal>
    </ComposeContext.Provider>
  );
}

export function useCompose() {
  const ctx = useContext(ComposeContext);
  if (!ctx) throw new Error("useCompose must be used within ComposeProvider");
  return ctx;
}
