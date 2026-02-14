import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function BatchConvertScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/convert");
  }, [router]);

  return null;
}
