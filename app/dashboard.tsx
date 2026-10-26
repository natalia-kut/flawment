"use client";

import Image from "next/image";
import { ChatLog } from "@/components/flawiusz/chat-log";
import { Composer } from "@/components/flawiusz/composer";
import type { FlawiuszChat } from "@/components/flawiusz/use-flawiusz-chat";

// The dashboard starts with Flawiusz; the conversation stays inside this card.
export default function Dashboard({
  chat,
  firstName,
  projectCount,
  onOpenProjects,
  onOpenTemplate,
}: {
  chat: FlawiuszChat;
  firstName: string;
  projectCount: number;
  onOpenProjects: () => void;
  onOpenTemplate: (templateId: string) => void;
}) {
  const started = chat.messages.length > 0;

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">WORKSPACE</p>
        <h1>Welcome, {firstName}</h1>
      </header>

      <section className={`flawiusz-hero${started ? " started" : ""}`} aria-labelledby="flawiusz-hero-title">
        <div className="flawiusz-hero-intro">
          <Image className="flawiusz-hero-avatar" src="/flawiusz.png" alt="" width={68} height={68} priority />
          <div>
            <h2 id="flawiusz-hero-title">Hi, I&apos;m Flawiusz. What are we working on today?</h2>
            {!started && (
              <p className="flawiusz-hero-copy">
                Ask about your projects, deadlines and team, or let me draft a document template for you.
              </p>
            )}
          </div>
          {started && (
            <button className="secondary-button" type="button" onClick={chat.reset}>
              New chat
            </button>
          )}
        </div>

        {started && <ChatLog chat={chat} className="in-hero" onOpenTemplate={onOpenTemplate} />}

        <Composer chat={chat} placeholder="e.g. What should I focus on this week?" />
      </section>

      <section className="workspace-card dashboard-projects">
        <h2>{projectCount} accessible projects</h2>
        <p>Create projects and manage memberships from Projects.</p>
        <button className="primary-button" onClick={onOpenProjects}>Open projects</button>
      </section>
    </>
  );
}
