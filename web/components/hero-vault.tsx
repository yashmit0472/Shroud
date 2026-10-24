import Image from "next/image";

function Plate({variant}:{variant:"glass"|"active"|"base"}){
  return <div className={`vault-plate vault-plate--${variant}`}>
    <div className="vault-face vault-face--bottom" />
    <div className="vault-face vault-face--left" />
    <div className="vault-face vault-face--right" />
    <div className="vault-face vault-face--front" />
    <div className="vault-face vault-face--back" />
    <div className="vault-face vault-face--top">
      <div className="vault-etch"><i/><i/><i/><i/></div>
      <span className="vault-plate-code">{variant==="glass"?"01 / DEV":variant==="active"?"02 / STG":"03 / PROD"}</span>
      <span className="vault-corner vault-corner--a"/><span className="vault-corner vault-corner--b"/>
    </div>
  </div>;
}

export function HeroVault(){
  return <div className="hero-vault" aria-hidden="true">
    <div className="vault-halo"/>
    <div className="vault-caption"><span>SHROUD / SECURE CORE</span><span>001—003</span></div>
    <div className="vault-scene">
      <div className="vault-floor"/>
      <div className="vault-float"><div className="vault-assembly">
        <Plate variant="base"/>
        <div className="vault-light-column"/>
        <Plate variant="active"/>
        <div className="vault-core"><div className="vault-core-top"><Image src="/brand/shroud-logo.png" width={80} height={80} alt="" unoptimized/></div><div className="vault-core-side"/><div className="vault-core-edge"/></div>
        <Plate variant="glass"/>
      </div></div>
    </div>
    <div className="vault-security-tag"><span className="vault-status-dot"/><span>Encrypted at rest</span><span className="vault-tag-detail">AES-256-GCM</span></div>
    <div className="vault-environments"><span><i/>Development</span><span><i/>Staging</span><span><i/>Production</span></div>
  </div>;
}
