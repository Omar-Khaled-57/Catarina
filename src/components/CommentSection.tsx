"use client";

/**
 * CommentSection — Displays and allows adding comments on a goal.
 * Shows comment thread with author names and timestamps.
 * Admin comments are highlighted with accent styling.
 * Uses ref-based state tracking to avoid setState-in-effect lint errors.
 */

import { useState, useEffect, useRef } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { toast } from "sonner";

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  author: { name: string; role: string };
}

interface CommentSectionProps {
  isOpen: boolean;
  onClose: () => void;
  goalId: string;
  goalName: string;
}

export default function CommentSection({
  isOpen,
  onClose,
  goalId,
  goalName,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevOpenRef = useRef(isOpen);

  /* Sync with external API — single effect handles open/close transitions */
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = isOpen;

    if (isOpen && !wasOpen && goalId) {
      /* Modal just opened — fetch comments from external API */
      const controller = new AbortController();

      fetch(`/api/goals/${goalId}/comments`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (!controller.signal.aborted) {
            setComments(data.comments || []);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            toast.error("Failed to load comments");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });

      return () => controller.abort();
    }

    if (!isOpen && wasOpen) {
      /* Modal just closed — clear stale data */
      setComments([]);
      setNewComment("");
      setIsLoading(false);
    }
  }, [isOpen, goalId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/goals/${goalId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
      } else {
        toast.error("Failed to add comment");
      }
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Comments — ${goalName}`}>
      {/* Comment List */}
      <div className="space-y-3 mb-4 max-h-80 overflow-y-auto modal-scroll">
        {isLoading ? (
          <div className="text-center py-8 text-text-muted">Loading...</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            No comments yet. Be the first to add one.
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-xl p-3 ${
                comment.author.role === "ADMIN"
                  ? "bg-accent/5 border border-accent/10"
                  : "bg-surface-2"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-text">
                  {comment.author.name}
                  {comment.author.role === "ADMIN" && (
                    <span className="ml-1.5 text-xs text-accent">(Admin)</span>
                  )}
                </span>
                <span className="text-xs text-text-muted">
                  {(() => {
                    const d = new Date(comment.createdAt);
                    const day = String(d.getDate()).padStart(2, "0");
                    const month = String(d.getMonth() + 1).padStart(2, "0");
                    const year = String(d.getFullYear()).slice(-2);
                    const hours = String(d.getHours()).padStart(2, "0");
                    const mins = String(d.getMinutes()).padStart(2, "0");
                    return `${day}/${month}/${year} ${hours}:${mins}`;
                  })()}
                </span>
              </div>
              <p className="text-sm text-text-muted">{comment.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
        />
        <Button
          type="submit"
          isLoading={isSubmitting}
          disabled={!newComment.trim()}
        >
          Send
        </Button>
      </form>
    </Modal>
  );
}
