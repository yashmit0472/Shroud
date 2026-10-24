"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useAuthStatus} from "@/components/auth-session-provider";
import {signedInRedirectPath} from "@/lib/auth-redirect";

// Also covers browser back/forward and client-cached sign-in pages, where the
// server proxy may not receive a new request.
export function useSignedInRedirect(){
  const status=useAuthStatus(),router=useRouter();
  useEffect(()=>{
    if(status!=="signed-in")return;
    router.replace(signedInRedirectPath(new URLSearchParams(window.location.search).get("redirect")));
    router.refresh();
  },[status,router]);
}
