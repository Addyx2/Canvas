/**
 * Anyone can create an organisation in Elements. Set ALLOW_SIGNUP=false to
 * make it invite-only.
 */
export async function signupOpen(): Promise<boolean> {
  return process.env.ALLOW_SIGNUP !== "false";
}
