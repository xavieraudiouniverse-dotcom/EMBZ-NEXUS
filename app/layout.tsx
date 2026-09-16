import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'EMBZ NEXUS — Development workspace',description:'Build, review and ship with your AI development workspace.',icons:{icon:'/favicon.svg'},robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
