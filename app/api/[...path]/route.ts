import { handle } from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, context: any) { const { path } = await context.params; return handle(request, path); }
export async function POST(request: Request, context: any) { const { path } = await context.params; return handle(request, path); }
