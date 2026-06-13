import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { VirtualMatchCard } from './VirtualMatchCard';
import { useVirtualization } from './VirtualizationProvider';
import type { Match } from '@/types';
import type { Prediction } from '@/types';

interface VirtualMatchListProps {
  matches: Match[];
  predictions?: Prediction[];
  onSavePrediction?: (matchId: string, homeScore: number, awayScore: number) => void;
  userId?: string;
  containerHeight?: number;
  overscan?: number;
}

export function VirtualMatchList({
  matches,
  predictions = [],
  onSavePrediction,
  userId,
  containerHeight = 600,
  overscan = 5,
}: VirtualMatchListProps) {
  const { isEnabled, estimatedItemHeight, compatibility } = useVirtualization();
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Determine if virtualization should be used
  const shouldUseVirtualization = useMemo(() => {
    if (!isEnabled) return false;
    if (!compatibility.shouldUseVirtualization) return false;
    
    // Don't virtualize small lists (under 10 items)
    if (matches.length <= 10) return false;
    
    return true;
  }, [isEnabled, compatibility.shouldUseVirtualization, matches.length]);

  const predictionMap = useMemo(() => {
    const map = new Map<string, Prediction>();
    predictions.forEach(prediction => {
      map.set(prediction.match_id, prediction);
    });
    return map;
  }, [predictions]);

  // If virtualization should not be used, render a fallback
  if (!shouldUseVirtualization) {
    return (
      <div className="space-y-4">
        {compatibility.fallbackReason && matches.length > 10 && (
          <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <div className="font-medium">Desplazamiento virtual deshabilitado</div>
            <div className="text-yellow-700 mt-1">{compatibility.fallbackReason}</div>
          </div>
        )}
        
        {matches.map(match => (
          <VirtualMatchCard
            key={match.id}
            match={match}
            prediction={predictionMap.get(match.id)}
            onSavePrediction={onSavePrediction}
            userId={userId}
            style={undefined}
          />
        ))}
      </div>
    );
  }

  // Create a virtualizer instance (only when virtualization is used)
  const virtualizer = useVirtualizer({
    count: matches.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="virtual-match-list">
      {/* Container for virtualization */}
      <div
        ref={parentRef}
        className="overflow-auto border border-gray-200 rounded-lg"
        style={{ height: containerHeight }}
        role="list"
        aria-label="Lista de partidos con desplazamiento virtual"
      >
        {/* Virtualized items container */}
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {virtualItems.map(virtualItem => {
            const match = matches[virtualItem.index];
            if (!match) return null;
            return (
              <div
                key={match.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: virtualItem.size,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                data-index={virtualItem.index}
                role="listitem"
                aria-label={`Partido ${virtualItem.index + 1} de ${matches.length}`}
              >
                <VirtualMatchCard
                  match={match}
                  prediction={predictionMap.get(match.id)}
                  onSavePrediction={onSavePrediction}
                  userId={userId}
                  style={undefined}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance indicators */}
      <div className="mt-4 text-sm text-gray-500 flex justify-between items-center">
        <div>
          Mostrando {virtualItems.length} de {matches.length} partidos
          {matches.length > virtualItems.length && (
            <span className="ml-2">
              (desplazamiento virtual activado)
            </span>
          )}
        </div>
        <div className="text-xs bg-gray-100 px-2 py-1 rounded">
          {matches.length} partidos • {Math.round(virtualizer.getTotalSize() / 100)}px total
        </div>
      </div>
    </div>
  );
}

// Grouped variant for matches organized by date or phase
interface GroupedVirtualMatchListProps {
  groups: Array<{
    id: string;
    title: string;
    matches: Match[];
  }>;
  predictions?: Prediction[];
  onSavePrediction?: (matchId: string, homeScore: number, awayScore: number) => void;
  userId?: string;
  containerHeight?: number;
}

export function GroupedVirtualMatchList({
  groups,
  predictions = [],
  onSavePrediction,
  userId,
  containerHeight = 800,
}: GroupedVirtualMatchListProps) {
  const { isEnabled, compatibility } = useVirtualization();
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Flatten all matches for virtualization
  const allMatches = useMemo(() => {
    return groups.flatMap(group => group.matches);
  }, [groups]);

  // Create offsets for each group
  const groupOffsets = useMemo(() => {
    let offset = 0;
    const offsets: Array<{ groupId: string; title: string; start: number; end: number; count: number }> = [];
    
    groups.forEach(group => {
      offsets.push({
        groupId: group.id,
        title: group.title,
        start: offset,
        end: offset + group.matches.length - 1,
        count: group.matches.length,
      });
      offset += group.matches.length;
    });
    
    return offsets;
  }, [groups]);

  // Memoize prediction map (declared once at function scope)
  const predictionMap = useMemo(() => {
    const map = new Map<string, Prediction>();
    predictions.forEach(prediction => {
      map.set(prediction.match_id, prediction);
    });
    return map;
  }, [predictions]);

  // Determine if virtualization should be used
  const shouldUseVirtualization = useMemo(() => {
    if (!isEnabled) return false;
    if (!compatibility.shouldUseVirtualization) return false;
    
    // Don't virtualize small lists (under 10 total items)
    if (allMatches.length <= 10) return false;
    
    return true;
  }, [isEnabled, compatibility.shouldUseVirtualization, allMatches.length]);

  // If virtualization should not be used, render a fallback
  if (!shouldUseVirtualization) {
    return (
      <div className="space-y-8">
        {compatibility.fallbackReason && allMatches.length > 10 && (
          <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <div className="font-medium">Desplazamiento virtual deshabilitado</div>
            <div className="text-yellow-700 mt-1">{compatibility.fallbackReason}</div>
          </div>
        )}
        
        {groups.map(group => (
          <div key={group.id} className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
              {group.title} ({group.matches.length} partidos)
            </h3>
            <div className="space-y-4">
              {group.matches.map(match => (
                <VirtualMatchCard
                  key={match.id}
                  match={match}
                  prediction={predictionMap.get(match.id)}
                  onSavePrediction={onSavePrediction}
                  userId={userId}
                  style={undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const { estimatedItemHeight } = useVirtualization();
  
  const virtualizer = useVirtualizer({
    count: allMatches.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemHeight + 50, // Extra for group headers
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="grouped-virtual-match-list">
      <div
        ref={parentRef}
        className="overflow-auto border border-gray-200 rounded-lg"
        style={{ height: containerHeight }}
        role="list"
        aria-label="Lista agrupada de partidos con desplazamiento virtual"
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {virtualItems.map(virtualItem => {
            const matchIndex = virtualItem.index;
            const match = allMatches[matchIndex];
            if (!match) return null;
            
            // Find which group this match belongs to
            const groupInfo = groupOffsets.find(
              offset => matchIndex >= offset.start && matchIndex <= offset.end
            );
            
            const isFirstInGroup = groupInfo && matchIndex === groupInfo.start;

            return (
              <div
                key={match.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: virtualItem.size,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                data-index={matchIndex}
                role="listitem"
                aria-label={`Partido ${matchIndex + 1} de ${allMatches.length}`}
              >
                {isFirstInGroup && (
                  <div className="sticky top-0 bg-white z-10 pb-2 mb-2 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {groupInfo.title} ({groupInfo.count} partidos)
                    </h3>
                  </div>
                )}
                
                <VirtualMatchCard
                  match={match}
                  prediction={predictionMap.get(match.id)}
                  onSavePrediction={onSavePrediction}
                  userId={userId}
                  style={undefined}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-500 flex justify-between items-center">
        <div>
          {groups.length} grupos • {allMatches.length} partidos total
          {allMatches.length > virtualItems.length && (
            <span className="ml-2">
              (desplazamiento virtual activado)
            </span>
          )}
        </div>
        <div className="text-xs bg-gray-100 px-2 py-1 rounded">
          {virtualItems.length} partidos visibles
        </div>
      </div>
    </div>
  );
}