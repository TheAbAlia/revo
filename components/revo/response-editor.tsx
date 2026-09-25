'use client';

import { useState } from 'react';
import {
  Check,
  ChevronDown,
  RefreshCw,
  Send,
  Sparkles
} from 'lucide-react';

const mockResponse =
  'Thank you for taking the time to share your experience. We’re glad to hear our team was helpful and that everything went smoothly. We really appreciate your recommendation and look forward to welcoming you again.';

export function ResponseEditor() {
  const [response, setResponse] = useState('');
  const [approved, setApproved] = useState(false);

  const generate = () => {
    setResponse(mockResponse);
    setApproved(false);
  };

  if (!response) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center px-8 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-surface">
          <Sparkles className="h-4 w-4" />
        </div>

        <h3 className="mt-4 text-[13px] font-semibold">
          Generate a response
        </h3>

        <p className="mt-1 max-w-[300px] text-xs leading-5 text-muted-foreground">
          Revo will create a response using your brand voice and the context of this review.
        </p>

        <button
          type="button"
          onClick={generate}
          className="mt-5 flex h-8 items-center gap-2 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate response
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-11 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Response</span>

          <button
            type="button"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Default voice
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <button
          type="button"
          onClick={generate}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </button>
      </div>

      <textarea
        value={response}
        onChange={(event) => {
          setResponse(event.target.value);
          setApproved(false);
        }}
        className="min-h-[190px] w-full resize-none bg-transparent px-4 py-4 text-[13px] leading-6 outline-none"
      />

      <div className="flex items-center justify-between border-t px-4 py-3">
        <span className="text-[11px] text-muted-foreground">
          {response.length} characters
        </span>

        <div className="flex items-center gap-2">
          {!approved ? (
            <button
              type="button"
              onClick={() => setApproved(true)}
              className="flex h-8 items-center gap-2 rounded-md border bg-surface px-3 text-xs font-medium hover:bg-muted"
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </button>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Check className="h-3.5 w-3.5" />
                Approved
              </span>

              <button
                type="button"
                className="flex h-8 items-center gap-2 rounded-md bg-foreground px-3 text-xs font-medium text-background hover:opacity-90"
              >
                <Send className="h-3.5 w-3.5" />
                Publish
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
