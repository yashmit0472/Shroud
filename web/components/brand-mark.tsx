import Image from "next/image";

export function BrandMark(){
  return <span className="brand-mark" aria-hidden="true"><Image src="/brand/shroud-logo.png" width={28} height={28} alt="" unoptimized /></span>;
}
