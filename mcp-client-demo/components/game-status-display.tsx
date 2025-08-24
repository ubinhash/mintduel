'use client';

import { useEffect, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Gamepad2, Heart, Zap, Shield, RotateCcw, Clock, Trophy, RefreshCw } from 'lucide-react';
import { shapeSepolia } from 'viem/chains';
import { createPublicClient, http } from 'viem';

// OtomDuel contract ABI for the functions we need
const otomDuelAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "player",
        type: "address"
      }
    ],
    name: "playerActiveGame",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256"
      }
    ],
    name: "getGame",
    outputs: [
      {
        internalType: "address",
        name: "player",
        type: "address"
      },
      {
        internalType: "uint256[]",
        name: "stakedOtomIds",
        type: "uint256[]"
      },
      {
        internalType: "uint256[]",
        name: "otomMasses",
        type: "uint256[]"
      },
      {
        internalType: "uint256",
        name: "agentHealth",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "currentRound",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "accumulatedCharge",
        type: "uint256"
      },
      {
        internalType: "uint8",
        name: "state",
        type: "uint8"
      },
      {
        internalType: "uint256",
        name: "stakeAmount",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "refundAmount",
        type: "uint256"
      },
      {
        internalType: "bool",
        name: "refundClaimed",
        type: "bool"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "gameId",
        type: "uint256"
      }
    ],
    name: "whoseTurn",
    outputs: [
      {
        internalType: "uint256",
        name: "round",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "turnStatus",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;

// Contract address - you'll need to update this with your deployed contract address
const OTOM_DUEL_ADDRESS = '0xC43Cf2fAc9813eBDd92123681b9dDD74De1D4d60'; // Update with actual address

// Create public client for direct contract reads
const publicClient = createPublicClient({
  chain: shapeSepolia,
  transport: http('https://sepolia.shape.network'),
});

interface GameStatus {
  gameId: number;
  agentHealth: number;
  currentRound: number;
  accumulatedCharge: number;
  gameState: string;
  turnStatus: number;
  stakeAmount: string;
  refundAmount: string;
  refundClaimed: boolean;
  hasActiveGame: boolean;
}

export function GameStatusDisplay() {
  const { address, isConnected } = useAccount();
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Refetch all contract data
      await Promise.all([
        refetchActiveGame(),
        activeGameId && Number(activeGameId.toString()) > 0 ? refetchGameData() : Promise.resolve(),
        activeGameId && Number(activeGameId.toString()) > 0 ? refetchTurnData() : Promise.resolve(),
      ]);
    } catch (error) {
      console.error('Error refreshing game status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Read active game ID
  const { data: activeGameId, refetch: refetchActiveGame } = useReadContract({
    address: OTOM_DUEL_ADDRESS as `0x${string}`,
    abi: otomDuelAbi,
    functionName: 'playerActiveGame',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address,
      refetchInterval: 5000, // Auto-refresh every 5 seconds
    },
  });

  // Read game details if there's an active game
  const { data: gameData, refetch: refetchGameData } = useReadContract({
    address: OTOM_DUEL_ADDRESS as `0x${string}`,
    abi: otomDuelAbi,
    functionName: 'getGame',
    args: [activeGameId as bigint],
    query: {
      enabled: !!activeGameId && Number(activeGameId.toString()) > 0,
    },
  });

  // Read turn status if there's an active game
  const { data: turnData, refetch: refetchTurnData } = useReadContract({
    address: OTOM_DUEL_ADDRESS as `0x${string}`,
    abi: otomDuelAbi,
    functionName: 'whoseTurn',
    args: [activeGameId as bigint],
    query: {
      enabled: !!activeGameId && Number(activeGameId.toString()) > 0,
    },
  });

  useEffect(() => {
    if (!isConnected || !address) {
      setGameStatus(null);
      return;
    }

    if (!activeGameId || Number(activeGameId.toString()) === 0) {
      setGameStatus({
        gameId: 0,
        agentHealth: 0,
        currentRound: 0,
        accumulatedCharge: 0,
        gameState: 'NO_GAME',
        turnStatus: 0,
        stakeAmount: '0',
        refundAmount: '0',
        refundClaimed: false,
        hasActiveGame: false,
      });
      return;
    }

    if (gameData && turnData) {
      const [
        player,
        stakedOtomIds,
        otomMasses,
        agentHealth,
        currentRound,
        accumulatedCharge,
        state,
        stakeAmount,
        refundAmount,
        refundClaimed
      ] = gameData;

      const [round, turnStatus] = turnData;

      const gameStateMap = ['WAITING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
      
      setGameStatus({
        gameId: Number(activeGameId),
        agentHealth: Number(agentHealth),
        currentRound: Number(currentRound),
        accumulatedCharge: Number(accumulatedCharge),
        gameState: gameStateMap[Number(state)] || 'UNKNOWN',
        turnStatus: Number(turnStatus),
        stakeAmount: (Number(stakeAmount) / 1e18).toFixed(4),
        refundAmount: (Number(refundAmount) / 1e18).toFixed(4),
        refundClaimed,
        hasActiveGame: true,
      });
    }
  }, [isConnected, address, activeGameId, gameData, turnData]);

  const getTurnDescription = (turnStatus: number) => {
    switch (turnStatus) {
      case 0: return 'Agent needs to commit move';
      case 1: return 'Player needs to make move';
      case 2: return 'Agent needs to reveal move';
      default: return 'Unknown turn status';
    }
  };

  const getGameStateColor = (state: string) => {
    switch (state) {
      case 'ACTIVE': return 'bg-green-500';
      case 'COMPLETED': return 'bg-blue-500';
      case 'CANCELLED': return 'bg-red-500';
      case 'WAITING': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  if (!isConnected) {
    return null;
  }

  if (!gameStatus) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              Game Status
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading game status...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            Game Status
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!gameStatus.hasActiveGame ? (
          <div className="text-center py-4">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No active game found</p>
            <p className="text-xs text-muted-foreground mt-1">Start a new game to begin your duel!</p>
          </div>
        ) : (
          <>
            {/* Game Info */}
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Game #{gameStatus.gameId}</span>
                <Badge className={`${getGameStateColor(gameStatus.gameState)} text-white text-xs`}>
                  {gameStatus.gameState}
                </Badge>
              </div>
              <span className="text-muted-foreground">Round {gameStatus.currentRound}/3</span>
            </div>

            {/* Agent Health */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Heart className="h-4 w-4 text-red-500" />
                  Agent Health
                </span>
                <span className="font-semibold">{gameStatus.agentHealth}/100</span>
              </div>
              <Progress value={gameStatus.agentHealth} className="h-2" />
            </div>

            {/* Accumulated Charge */}
            {gameStatus.accumulatedCharge > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Accumulated Charge
                </span>
                <span className="font-semibold">{gameStatus.accumulatedCharge}</span>
              </div>
            )}

            {/* Turn Status */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Current Turn:</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {getTurnDescription(gameStatus.turnStatus)}
              </p>
            </div>



            {/* Refund Status */}
            {gameStatus.gameState === 'COMPLETED' && (
              <div className="text-center">
                <Badge variant={gameStatus.refundClaimed ? "default" : "secondary"}>
                  {gameStatus.refundClaimed ? "Refund Claimed" : "Refund Available"}
                </Badge>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
} 