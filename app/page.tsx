import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";

export default async function Home() {
  const user = await sessionUser();
  redirect(user ? "/dashboard" : "/login");
}
