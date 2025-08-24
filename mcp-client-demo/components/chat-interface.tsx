'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { PrepareMintSVGNFTData, PrepareStartGameData, PreparePlayerMoveData, PrepareClaimRefundData } from '@/types';
import { useChat } from '@ai-sdk/react';
import { Bot, ChevronDown, ChevronRight, Info, Send, User, Wallet } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAccount } from 'wagmi';
import { MintTransactionHandler } from './mint-transaction-handler';
import { StartGameTransactionHandler } from './start-game-transaction-handler';
import { PlayerMoveTransactionHandler } from './player-move-transaction-handler';
import { ClaimRefundTransactionHandler } from './claim-refund-transaction-handler';

export function ChatInterface() {
  const { isConnected, address } = useAccount();
  const { messages, input, handleInputChange, handleSubmit, status, error, setInput } = useChat({
    api: '/api/chat',
    maxSteps: 5, // Allow up to 5 sequential tool calls
    body: {
      walletAddress: address,
    },
  });

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector(
          '[data-radix-scroll-area-viewport]'
        );
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [messages.length]);



  const toggleMessageExpansion = (messageId: string) => {
    setExpandedMessages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const detectTransactionResponse = (content: string): PrepareMintSVGNFTData | PrepareStartGameData | PreparePlayerMoveData | PrepareClaimRefundData | null => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.success && parsed.transaction && parsed.metadata?.functionName) {
        if (parsed.metadata.functionName === 'mintNFT') {
          return parsed as PrepareMintSVGNFTData;
        }
        if (parsed.metadata.functionName === 'startGame') {
          return parsed as PrepareStartGameData;
        }
        if (parsed.metadata.functionName === 'playerPlay') {
          return parsed as PreparePlayerMoveData;
        }
        if (parsed.metadata.functionName === 'claimRefund') {
          return parsed as PrepareClaimRefundData;
        }
      }
    } catch {
      const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = content.match(jsonBlockRegex);
      if (match) {
        const parsed = JSON.parse(match[1]);
        if (parsed.success && parsed.transaction && parsed.metadata?.functionName) {
          if (parsed.metadata.functionName === 'mintNFT') {
            return parsed as PrepareMintSVGNFTData;
          }
          if (parsed.metadata.functionName === 'startGame') {
            return parsed as PrepareStartGameData;
          }
          if (parsed.metadata.functionName === 'playerPlay') {
            return parsed as PreparePlayerMoveData;
          }
          if (parsed.metadata.functionName === 'claimRefund') {
            return parsed as PrepareClaimRefundData;
          }
        }
      }
      // Check for mint NFT pattern
      const mintJsonRegex =
        /\{[\s\S]*"success"\s*:\s*true[\s\S]*"transaction"[\s\S]*"mintNFT"[\s\S]*\}/;
      const mintJsonMatch = content.match(mintJsonRegex);
      if (mintJsonMatch) {
        const parsed = JSON.parse(mintJsonMatch[0]);
        if (parsed.success && parsed.transaction && parsed.metadata?.functionName === 'mintNFT') {
          return parsed as PrepareMintSVGNFTData;
        }
      }
      // Check for start game pattern
      const startGameJsonRegex =
        /\{[\s\S]*"success"\s*:\s*true[\s\S]*"transaction"[\s\S]*"startGame"[\s\S]*\}/;
      const startGameJsonMatch = content.match(startGameJsonRegex);
      if (startGameJsonMatch) {
        const parsed = JSON.parse(startGameJsonMatch[0]);
        if (parsed.success && parsed.transaction && parsed.metadata?.functionName === 'startGame') {
          return parsed as PrepareStartGameData;
        }
      }
      // Check for player move pattern
      const playerMoveJsonRegex =
        /\{[\s\S]*"success"\s*:\s*true[\s\S]*"transaction"[\s\S]*"playerPlay"[\s\S]*\}/;
      const playerMoveJsonMatch = content.match(playerMoveJsonRegex);
      if (playerMoveJsonMatch) {
        const parsed = JSON.parse(playerMoveJsonMatch[0]);
        if (parsed.success && parsed.transaction && parsed.metadata?.functionName === 'playerPlay') {
          return parsed as PreparePlayerMoveData;
        }
      }
      // Check for claim refund pattern
      const claimRefundJsonRegex =
        /\{[\s\S]*"success"\s*:\s*true[\s\S]*"transaction"[\s\S]*"claimRefund"[\s\S]*\}/;
      const claimRefundJsonMatch = content.match(claimRefundJsonRegex);
      if (claimRefundJsonMatch) {
        const parsed = JSON.parse(claimRefundJsonMatch[0]);
        if (parsed.success && parsed.transaction && parsed.metadata?.functionName === 'claimRefund') {
          return parsed as PrepareClaimRefundData;
        }
      }
    }
    return null;
  };

  const handleTransactionComplete = useCallback((hash: string) => {
    console.log('Transaction completed:', hash);
  }, []);

  const handleTransactionError = useCallback((error: string) => {
    console.error('Transaction failed:', error);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Demo Mode (rate limited):</strong> Click on assistant responses that used tools to
          expand and view the tool calls and raw responses.
        </AlertDescription>
      </Alert>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Shape Chat Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConnected ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 text-center">
              <Wallet className="h-16 w-16 text-gray-300" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Connect Your Wallet</h3>
                <p className="text-muted-foreground max-w-md">
                  Please connect your wallet to use the Shape AI chatbot.
                </p>
              </div>
              <Alert className="max-w-md">
                <AlertDescription>
                  Click the &quot;Connect Wallet&quot; button in the top right corner to get
                  started.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <>
              <ScrollArea ref={scrollAreaRef} className="h-[400px] pr-4 sm:h-[720px]">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="text-muted-foreground py-8 text-center">
                      <Bot className="mx-auto mb-2 h-12 w-12 opacity-50" />
                      <p>Start a conversation with the Shape assistant!</p>
                      <p className="mt-1 text-sm">
                        Try asking about Shape Network data, how much gasback you can earn or
                        analytics for a given collection.
                      </p>
                    </div>
                  )}

                  {messages.map((message) => {
                    // Check if this message contains a transaction response
                    let transaction: PrepareMintSVGNFTData | PrepareStartGameData | PreparePlayerMoveData | PrepareClaimRefundData | null = null;

                    if (message.role === 'assistant') {
                      // First check the message content
                      transaction = detectTransactionResponse(message.content);

                      // If not found in content, check tool results
                      if (!transaction && message.parts) {
                        for (const part of message.parts) {
                          if (
                            part.type === 'tool-invocation' &&
                            part.toolInvocation.state === 'result'
                          ) {
                            try {
                              const toolResult = part.toolInvocation.result;
                              if (toolResult?.content?.[0]?.text) {
                                const parsed = JSON.parse(toolResult.content[0].text);
                                if (
                                  parsed.success &&
                                  parsed.transaction &&
                                  parsed.metadata?.functionName
                                ) {
                                  // Check for mint NFT transaction
                                  if (
                                    part.toolInvocation.toolName === 'prepareMintSVGNFT' &&
                                    parsed.metadata.functionName === 'mintNFT'
                                  ) {
                                    transaction = parsed as PrepareMintSVGNFTData;
                                    break;
                                  }
                                  // Check for start game transaction
                                  if (
                                    part.toolInvocation.toolName === 'prepareStartGame' &&
                                    parsed.metadata.functionName === 'startGame'
                                  ) {
                                    transaction = parsed as PrepareStartGameData;
                                    break;
                                  }
                                  // Check for player move transaction
                                  if (
                                    part.toolInvocation.toolName === 'preparePlayerMove' &&
                                    parsed.metadata.functionName === 'playerPlay'
                                  ) {
                                    transaction = parsed as PreparePlayerMoveData;
                                    break;
                                  }
                                  // Check for claim refund transaction
                                  if (
                                    part.toolInvocation.toolName === 'prepareClaimRefund' &&
                                    parsed.metadata.functionName === 'claimRefund'
                                  ) {
                                    transaction = parsed as PrepareClaimRefundData;
                                    break;
                                  }
                                }
                              }
                            } catch {
                              // Ignore parsing errors
                            }
                          }
                        }
                      }
                    }

                    return (
                      <div key={message.id} className="space-y-2">
                        <div
                          className={cn(
                            'flex items-start gap-3',
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          )}
                        >
                          {message.role === 'assistant' && (
                            <div className="bg-primary flex size-5 flex-shrink-0 items-center justify-center rounded-full sm:size-8">
                              <Bot className="text-primary-foreground size-3 sm:size-5" />
                            </div>
                          )}

                          <div
                            className={cn(
                              'rounded-lg p-3',
                              message.role === 'user'
                                ? 'bg-primary text-primary-foreground ml-auto max-w-[70vw]'
                                : 'bg-muted max-w-[60vw]'
                            )}
                          >
                            <div className="prose prose-sm prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 max-w-none break-words [&_img]:max-h-48 [&_img]:max-w-xs [&_img]:object-contain">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {message.content}
                              </ReactMarkdown>
                            </div>

                            {/* Show tool indicator when tools were used */}
                            {message.role === 'assistant' &&
                              message.parts?.some((part) => part.type === 'tool-invocation') && (
                                <button
                                  onClick={() => toggleMessageExpansion(message.id)}
                                  className="text-muted-foreground hover:text-foreground hover:bg-muted/50 mt-2 -ml-1 flex items-center gap-2 rounded p-1 text-xs transition-colors"
                                >
                                  {expandedMessages.has(message.id) ? (
                                    <ChevronDown className="h-3 w-3" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3" />
                                  )}
                                  <span>
                                    🔧{' '}
                                    {
                                      message.parts.filter(
                                        (part) => part.type === 'tool-invocation'
                                      ).length
                                    }{' '}
                                    tool
                                    {message.parts.filter((part) => part.type === 'tool-invocation')
                                      .length > 1
                                      ? 's'
                                      : ''}{' '}
                                    used
                                  </span>
                                </button>
                              )}

                            {/* Display tool calls if expanded */}
                            {expandedMessages.has(message.id) &&
                              message.parts?.some((part) => part.type === 'tool-invocation') && (
                                <div className="mt-3 border-t pt-3">
                                  <div className="space-y-3">
                                    {message.parts
                                      .filter((part) => part.type === 'tool-invocation')
                                      .map((part, index) => (
                                        <div
                                          key={part.toolInvocation.toolCallId}
                                          className="space-y-2"
                                        >
                                          <div className="text-muted-foreground text-xs font-medium">
                                            Step {index + 1}: {part.toolInvocation.toolName}
                                          </div>
                                          {part.toolInvocation.state === 'result' && (
                                            <div className="bg-background/50 rounded p-2 text-sm">
                                              <pre className="overflow-x-auto text-xs whitespace-pre-wrap sm:text-sm">
                                                {JSON.stringify(
                                                  part.toolInvocation.result,
                                                  null,
                                                  2
                                                )}
                                              </pre>
                                            </div>
                                          )}
                                          {part.toolInvocation.state === 'call' && (
                                            <div className="rounded bg-blue-50 p-2 text-sm text-blue-700">
                                              Executing tool...
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                          </div>

                          {message.role === 'user' && (
                            <div className="bg-muted flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        
                        {/* Render transaction handler inline with the message if it contains a transaction */}
                        {transaction && (
                          <div className="mt-3 ml-11">
                            {'metadata' in transaction && transaction.metadata.functionName === 'mintNFT' ? (
                              <MintTransactionHandler
                                transaction={transaction as PrepareMintSVGNFTData}
                                onComplete={handleTransactionComplete}
                                onError={handleTransactionError}
                              />
                            ) : transaction.metadata.functionName === 'startGame' ? (
                              <StartGameTransactionHandler
                                transaction={transaction as PrepareStartGameData}
                                onComplete={handleTransactionComplete}
                                onError={handleTransactionError}
                              />
                            ) : transaction.metadata.functionName === 'claimRefund' ? (
                              <ClaimRefundTransactionHandler
                                transaction={transaction as PrepareClaimRefundData}
                                onComplete={handleTransactionComplete}
                                onError={handleTransactionError}
                              />
                            ) : (
                              <PlayerMoveTransactionHandler
                                transaction={transaction as PreparePlayerMoveData}
                                onComplete={handleTransactionComplete}
                                onError={handleTransactionError}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}



                  {(status === 'submitted' || status === 'streaming') && (
                    <div className="flex items-start gap-3">
                      <div className="bg-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                        <Bot className="text-primary-foreground h-4 w-4 animate-pulse" />
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-1">
                          <div
                            className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
                            style={{ animationDelay: '0ms' }}
                          />
                          <div
                            className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
                            style={{ animationDelay: '150ms' }}
                          />
                          <div
                            className="bg-muted-foreground h-2 w-2 animate-bounce rounded-full"
                            style={{ animationDelay: '300ms' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <Separator />

              {error && (
                <div className="bg-destructive/10 text-destructive mb-4 rounded p-3">
                  <p className="font-medium">
                    {error.message.includes('429') || error.message.includes('rate limit')
                      ? 'Rate Limit Exceeded'
                      : 'Something went wrong'}
                  </p>
                  <p className="text-sm">
                    {error.message.includes('429') || error.message.includes('rate limit')
                      ? "To prevent abuse of API keys, we've set a rate limit. Please wait a moment before trying again."
                      : error.message}
                  </p>
                </div>
              )}

              {/* Suggested prompts - only show when no messages */}
              {messages.length === 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-muted-foreground text-sm">Try these examples:</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {SUGGESTED_PROMPTS.map((suggestion) => (
                      <Button
                        key={suggestion.title}
                        variant="outline"
                        onClick={() => setInput(suggestion.prompt)}
                        disabled={status === 'submitted' || status === 'streaming'}
                        className="h-auto justify-start p-3 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{suggestion.title}</div>
                          <div className="text-muted-foreground mt-1 line-clamp-3 text-xs break-words">
                            {suggestion.prompt}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask about a Shape collection, or how much gasback you can earn"
                  disabled={status === 'submitted' || status === 'streaming'}
                  className="flex-1 text-sm sm:text-base"
                />
                <Button
                  type="submit"
                  disabled={status === 'submitted' || status === 'streaming' || !input.trim()}
                  className="flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const SUGGESTED_PROMPTS = [
  {
    title: 'Collection Analytics',
    prompt: 'Give me data about the DeePle collection (0xf2e4b2a15872a20d0ffb336a89b94ba782ce9ba5)',
  },
  {
    title: 'Gasback Simulator',
    prompt: 'How much gasback do I earn with 1000 tx / day for 6 months?',
  },
  {
    title: 'Shape Network Status & Information',
    prompt: 'Get the current Shape Network status and RPC information',
  },
  {
    title: 'Mint SVG NFT',
    prompt:
      'Create an SVG NFT for me with a simple black circle design, name it "My First Shape NFT" and mint it to my wallet',
  },
];
