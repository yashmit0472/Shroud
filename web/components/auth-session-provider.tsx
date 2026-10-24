"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthStatus = "checking" | "signed-in" | "signed-out";
const AuthSessionContext = createContext<AuthStatus>("checking");

export function AuthSessionProvider({children}:{children:React.ReactNode}) {
  const [status,setStatus] = useState<AuthStatus>("checking");
  useEffect(() => {
    // INITIAL_SESSION restores the persisted login. Later events keep public
    // pages in sync with sign-in, refresh, and sign-out in this or another tab.
    const {data:{subscription}} = createClient().auth.onAuthStateChange((_event,session) => {
      setStatus(session?.user ? "signed-in" : "signed-out");
    });
    return () => subscription.unsubscribe();
  },[]);
  return <AuthSessionContext.Provider value={status}>{children}</AuthSessionContext.Provider>;
}

export function useAuthStatus(){return useContext(AuthSessionContext);}
