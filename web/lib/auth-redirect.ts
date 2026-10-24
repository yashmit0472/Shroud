export function safeRedirectPath(value: string | null, fallback: string) {
  return value?.startsWith("/") && !value.startsWith("//") && !/[\\\x00-\x1f]/.test(value) ? value : fallback;
}

export function signedInRedirectPath(value:string|null){
  const path=safeRedirectPath(value,"/dashboard");
  const pathname=path.split(/[?#]/,1)[0].replace(/\/+$/,"");
  return ["/login","/auth/login","/auth/sign-up"].includes(pathname)?"/dashboard":path;
}
