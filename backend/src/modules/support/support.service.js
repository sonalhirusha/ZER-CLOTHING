// Support tickets (from the contact form) + newsletter signup.
import { prisma } from "../../lib/prisma.js";
import { fromJSON, toJSON } from "../../lib/json.js";
import { generateTicketNumber } from "../../lib/ids.js";
import { enqueueEmail, EMAIL_TEMPLATES } from "../../services/email.js";
import { ApiError } from "../../middleware/error.js";

function shapeTicket(t) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    email: t.email,
    name: t.name,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    messages: (t.messages || []).map((m) => ({
      author: m.author,
      body: m.body,
      attachments: fromJSON(m.attachments, []),
      createdAt: m.createdAt,
    })),
  };
}

export async function createTicket({ name, email, subject, message }, userId) {
  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber: generateTicketNumber(),
      userId: userId || null,
      email,
      name: name || null,
      subject: subject || "General enquiry",
      messages: { create: { author: "customer", body: message, attachments: "[]" } },
    },
    include: { messages: true },
  });

  // Confirmation email to the customer.
  await enqueueEmail(email, EMAIL_TEMPLATES.TICKET_UPDATE, {
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    message: "Thanks for reaching out — we've received your message and a member of the ZERØ team will reply shortly.",
  });

  return shapeTicket(ticket);
}

export async function listTickets({ status } = {}) {
  const where = {};
  if (status) where.status = status;
  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  return tickets.map(shapeTicket);
}

export async function getTicket(id) {
  const t = await prisma.supportTicket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!t) throw ApiError.notFound("Ticket not found");
  return shapeTicket(t);
}

export async function replyTicket(id, { body, status }, adminId) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) throw ApiError.notFound("Ticket not found");

  await prisma.ticketMessage.create({
    data: { ticketId: id, author: `admin:${adminId}`, body, attachments: "[]" },
  });
  const updated = await prisma.supportTicket.update({
    where: { id },
    data: { status: status || "pending", updatedAt: new Date() },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  await enqueueEmail(ticket.email, EMAIL_TEMPLATES.TICKET_UPDATE, {
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    message: body,
  });
  if (ticket.userId) {
    await prisma.notification.create({
      data: { userId: ticket.userId, type: "support", title: "Support reply", body: `We replied to ${ticket.ticketNumber}.`, link: "/account.html" },
    });
  }
  return shapeTicket(updated);
}

export async function subscribeNewsletter(email) {
  // Record the signup as an analytics event and send the welcome/discount email.
  await prisma.analyticsEvent.create({ data: { name: "newsletter_signup", props: toJSON({ email }) } });
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (user) await prisma.user.update({ where: { id: user.id }, data: { marketingOptIn: true } });
  await enqueueEmail(email, EMAIL_TEMPLATES.WELCOME, {});
  return { ok: true };
}
