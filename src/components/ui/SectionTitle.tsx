type SectionTitleProps = {
  title: string;
  sub?: string;
};

/** Judul section + subjudul abu-abu di bawahnya. */
export function SectionTitle({ title, sub }: SectionTitleProps) {
  return (
    <>
      <h2 className="text-[clamp(22px,2.6vw,30px)] font-bold">{title}</h2>
      {sub && <p className="mt-2.5 mb-5 max-w-[66ch] text-muted">{sub}</p>}
    </>
  );
}
