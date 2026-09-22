type HeroProps = {
  title: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
};

/** Bagian pembuka halaman: judul besar + lede. */
export function Hero({ title, lede, children }: HeroProps) {
  return (
    <section className="pt-8.5 pb-7 shell:pt-16 shell:pb-10">
      <Page>
        <h1 className="font-display max-w-[20ch] text-[clamp(30px,4.4vw,50px)] leading-[1.15]">{title}</h1>
        {lede && <p className="mt-4 max-w-[62ch] text-base text-muted">{lede}</p>}
        {children}
      </Page>
    </section>
  );
}

/** Kata di judul yang di-highlight oranye. */
export function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-accent [text-shadow:0_0_42px_var(--color-accent-glow)]">{children}</span>
  );
}

/** Pembungkus lebar konten (maks 1000px, di tengah). */
export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-250 px-4 shell:px-6">{children}</div>;
}

/** Section biasa di bawah hero. */
export function Block({ children }: { children: React.ReactNode }) {
  return (
    <section className="py-11">
      <Page>{children}</Page>
    </section>
  );
}
