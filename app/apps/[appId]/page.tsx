import { AppDetail } from "../../../components/AppDetail";
export default async function AppPage({params,searchParams}:{params:Promise<{appId:string}>;searchParams:Promise<{country?:string}>}){const[{appId},{country="cn"}]=await Promise.all([params,searchParams]);return <AppDetail appId={appId} country={country}/>}
