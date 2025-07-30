import { getServerSession } from "next-auth";
import { getAuthOptions, pool } from "@/app/api/auth/[...nextauth]/options";

export const serverSideAuthCheck = async (): Promise<boolean> => {
    const authOptions = await getAuthOptions()
    const session: any = await getServerSession(authOptions);
    if (!session?.user) return false;
    const res = await pool.query(`
      SELECT 
        users.*,
        json_build_object(
          'id', roles.id,
          'name', roles.name,
          'is_admin', roles.is_admin,
          'agents', roles.agents
        ) as role
      FROM users 
      LEFT JOIN roles ON users.role = roles.id 
      WHERE users.email = $1
    `, [session.user.email])
    const user: any = res.rows[0];
    if (!user) {
        return false;
    }
    console.log("res",res.rows)
    console.log("session.user.email",session.user.email)
    return user;

}