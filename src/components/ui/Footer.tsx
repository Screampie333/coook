import { Page } from "./Hero";

export function Footer() {
  return (
    <footer className="pb-11">
      <Page>
        <div className="flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-[12.5px] text-dim">
          <p>
            <span className="font-mono">kuk.ink</span> — memes for pump.fun coins
          </p>
          <p>
            Let it <span className="font-bold text-accent">kuk</span>.
          </p>
        </div>
      </Page>
    </footer>
  );
}
