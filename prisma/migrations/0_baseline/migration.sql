-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER', 'CARER');

-- CreateEnum
CREATE TYPE "InstallationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'UNINSTALLED');

-- CreateEnum
CREATE TYPE "EventDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "PeakEntryKind" AS ENUM ('SHIFT', 'ON_TIME', 'STREAK', 'PRAISE', 'AWARD', 'REDEMPTION', 'REVERSAL');

-- CreateEnum
CREATE TYPE "PeakRewardKind" AS ENUM ('CASH_OUT', 'PERK');

-- CreateEnum
CREATE TYPE "PeakRedemptionStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "GatewayChannel" AS ENUM ('WEBCHAT', 'SMS', 'VOICE');

-- CreateEnum
CREATE TYPE "GatewayStatus" AS ENUM ('WITH_AI', 'NEEDS_PERSON', 'WITH_PERSON', 'CLOSED');

-- CreateEnum
CREATE TYPE "GatewayIntent" AS ENUM ('ENQUIRY', 'MESSAGE', 'EMERGENCY', 'OTHER', 'ABSENCE', 'COVER_REQUEST');

-- CreateEnum
CREATE TYPE "GatewaySender" AS ENUM ('CONTACT', 'AGENT', 'STAFF', 'SYSTEM');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "personId" TEXT,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "jwksUri" TEXT,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "status" "InstallationStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "direction" "EventDirection" NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "deliveryStatus" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceKey" (
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceKey_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "PeakMember" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeakMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeakEntry" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" "PeakEntryKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceKey" TEXT,
    "byName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeakEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeakReward" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" "PeakRewardKind" NOT NULL,
    "cost" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeakReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeakRedemption" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "rewardId" TEXT,
    "rewardName" TEXT NOT NULL,
    "kind" "PeakRewardKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "amountPence" INTEGER,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "status" "PeakRedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeakRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayPerson" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'carer',
    "organisation" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayConversation" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "channel" "GatewayChannel" NOT NULL,
    "contact" TEXT NOT NULL,
    "contactName" TEXT,
    "personId" TEXT,
    "intent" "GatewayIntent" NOT NULL DEFAULT 'ENQUIRY',
    "status" "GatewayStatus" NOT NULL DEFAULT 'WITH_AI',
    "summary" TEXT,
    "handoverReason" TEXT,
    "staffName" TEXT,
    "agentState" JSONB NOT NULL DEFAULT '[]',
    "followUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpDoneAt" TIMESTAMP(3),
    "followUpBy" TEXT,
    "alertedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sender" "GatewaySender" NOT NULL,
    "body" TEXT NOT NULL,
    "staffName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'carer',
    "organisation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "personId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PeakBadge" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeakBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerOffer" (
    "id" TEXT NOT NULL,
    "partner" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'other',
    "headline" TEXT NOT NULL,
    "code" TEXT,
    "url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerOfferClaim" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerOfferClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_clientId_key" ON "Platform"("clientId");

-- CreateIndex
CREATE INDEX "Installation_organizationId_status_idx" ON "Installation"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Installation_platformId_moduleKey_tenantId_key" ON "Installation"("platformId", "moduleKey", "tenantId");

-- CreateIndex
CREATE INDEX "Event_installationId_createdAt_idx" ON "Event"("installationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PeakMember_installationId_personId_key" ON "PeakMember"("installationId", "personId");

-- CreateIndex
CREATE INDEX "PeakEntry_memberId_createdAt_idx" ON "PeakEntry"("memberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PeakEntry_installationId_sourceKey_key" ON "PeakEntry"("installationId", "sourceKey");

-- CreateIndex
CREATE INDEX "PeakRedemption_installationId_status_idx" ON "PeakRedemption"("installationId", "status");

-- CreateIndex
CREATE INDEX "GatewayPerson_installationId_phone_idx" ON "GatewayPerson"("installationId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayPerson_installationId_personId_key" ON "GatewayPerson"("installationId", "personId");

-- CreateIndex
CREATE INDEX "GatewayConversation_installationId_status_lastMessageAt_idx" ON "GatewayConversation"("installationId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "GatewayConversation_installationId_contact_idx" ON "GatewayConversation"("installationId", "contact");

-- CreateIndex
CREATE INDEX "GatewayMessage_conversationId_createdAt_idx" ON "GatewayMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Person_organizationId_kind_idx" ON "Person"("organizationId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_organizationId_idx" ON "Invite"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_kind_idx" ON "AuthToken"("userId", "kind");

-- CreateIndex
CREATE INDEX "PeakBadge_memberId_createdAt_idx" ON "PeakBadge"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "PeakBadge_installationId_createdAt_idx" ON "PeakBadge"("installationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerOfferClaim_offerId_memberId_key" ON "PartnerOfferClaim"("offerId", "memberId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Platform" ADD CONSTRAINT "Platform_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installation" ADD CONSTRAINT "Installation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installation" ADD CONSTRAINT "Installation_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeakMember" ADD CONSTRAINT "PeakMember_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeakEntry" ADD CONSTRAINT "PeakEntry_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeakEntry" ADD CONSTRAINT "PeakEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "PeakMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeakReward" ADD CONSTRAINT "PeakReward_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeakRedemption" ADD CONSTRAINT "PeakRedemption_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeakRedemption" ADD CONSTRAINT "PeakRedemption_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "PeakMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeakRedemption" ADD CONSTRAINT "PeakRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "PeakReward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayPerson" ADD CONSTRAINT "GatewayPerson_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayConversation" ADD CONSTRAINT "GatewayConversation_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayMessage" ADD CONSTRAINT "GatewayMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "GatewayConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeakBadge" ADD CONSTRAINT "PeakBadge_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeakBadge" ADD CONSTRAINT "PeakBadge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "PeakMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOfferClaim" ADD CONSTRAINT "PartnerOfferClaim_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PartnerOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOfferClaim" ADD CONSTRAINT "PartnerOfferClaim_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "PeakMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

