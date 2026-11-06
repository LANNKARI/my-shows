import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calendarUser,calendarFailure,privateJson,CalendarError } from '@/lib/calendar-server';
import { hasPermission,audit } from '@/lib/account-access';
export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{
 const userId=await calendarUser(req,true);if(req.headers.get('sec-fetch-site')==='cross-site')throw new CalendarError(403,'Недопустимый источник запроса');
 const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<1)throw new CalendarError(400,'Некорректный комментарий');
 await prisma.$transaction(async tx=>{
  const comment=await tx.comment.findUnique({where:{id}});if(!comment)throw new CalendarError(404,'Комментарий не найден');
  if(comment.userId!==userId&&!await hasPermission(userId,'moderate_comments',tx))throw new CalendarError(403,'Недостаточно прав');
  await tx.comment.delete({where:{id}});
  await audit(tx,userId,'commentDelete',String(id),{authorId:comment.userId,showId:comment.showId});
 });return privateJson({ok:true});
}catch(e){return calendarFailure(e)}}
