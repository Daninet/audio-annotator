import React, { useEffect, useRef, useState } from 'react';
import WaveSurferLib from 'wavesurfer.js';
import { debounce } from 'lodash';
import RegionsPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.regions.min';
import TimelinePlugin from 'wavesurfer.js/dist/plugin/wavesurfer.timeline.min';
// import SpectrogramPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.spectrogram.min';

let pendingRegion = null;

interface WaveSurferProps {
  file: File;
}

export const WaveSurfer: React.FC<WaveSurferProps> = ({ file }) => {
  const [label, setLabel] = useState('');
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const wsElement = useRef<HTMLDivElement>(null);
  const timelineElement = useRef<HTMLDivElement>(null);
  const spectrogramElement = useRef<HTMLDivElement>(null);
  const labelInputElement = useRef<HTMLInputElement>(null);
  const ws = useRef<WaveSurferLib>();

  const recalculateRegions = () => {
    if (!ws.current) return setRegions([]);
    const regions = ws.current.regions.list;
    const keys = Object.keys(regions);
    const ret = [];
    for (const regionKey of keys) {
      const region = regions[regionKey];
      ret.push({ start: region.start, end: region.end, key: regionKey });
      console.log(region);
    }
    ret.sort((a, b) => a.start - b.start);
    return setRegions(ret);
  };

  const onEnterRegion = (region) => {
    console.log('onEnterRegion', region);
    setSelectedRegion(region);
  }

  const onLeaveRegion = (region) => {
    console.log('onLeaveRegion', region);
    setSelectedRegion(null);
  }

  const onSeek = () => {
    const time = ws.current.getCurrentTime();
    console.log('onSeek', time);
    const regions = Object.values(ws.current.regions.list);
    const res = regions.find(region => region.start <= time && region.end >= time);
    if (!res) {
      setSelectedRegion(null);
    } else {
      setSelectedRegion(res);
    }
  }

  const onZoom = () => {
    // spectrograph has to be reinitialized
    console.log('onZoom');
  };

  useEffect(() => {
    ws.current = WaveSurferLib.create({
      container: wsElement.current as HTMLDivElement,
      waveColor: 'green',
      progressColor: 'blue',
      scrollParent: true,
      partialRender: true,
      plugins: [
        RegionsPlugin.create(),
        TimelinePlugin.create({ container: timelineElement.current }),
        // SpectrogramPlugin.create({ container: spectrogramElement.current }),
      ],
    });

    const debouncedRecalculate = debounce(recalculateRegions, 25);
    ws.current.on('region-created', debouncedRecalculate);
    ws.current.on('region-updated', debouncedRecalculate);
    ws.current.on('region-updated-end', debouncedRecalculate);
    ws.current.on('region-removed', debouncedRecalculate);
    ws.current.on('region-in', onEnterRegion);
    ws.current.on('region-out', onLeaveRegion);
    ws.current.on('seek', onSeek);
    ws.current.on('zoom', onZoom);
    ws.current.loadBlob(file);

    return () => ws.current.destroy();
  }, [file]);

  const onAddRegion = () => {
    const wsAny = ws.current as any;
    if (pendingRegion) {
      const start = pendingRegion.start;
      const end = wsAny.getCurrentTime();
      pendingRegion.remove();
      wsAny.addRegion({ start: Math.min(start, end), end: Math.max(start, end), drag: true, resize: true });
      pendingRegion = null;
    } else {
      const region = wsAny.addRegion({ start: wsAny.getCurrentTime(), end: wsAny.getCurrentTime(), drag: true, resize: true });
      pendingRegion = region;
    }
    console.log(wsAny.regions.list);
  };

  useEffect(() => {
    const handleKey = (code: string) => {
      if (code === 'Space') {
        if (ws.current.isPlaying()) {
          ws.current.pause();
        } else {
          ws.current.play();
        }
        return true;
      }
      if (code === 'Enter') {
        onAddRegion();
      }
      return false;
    };

    const listener = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.repeat) return;
      if (handleKey(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  const onSetLabel = (text: string) => {
    const key = selectedRegion.id;
    setLabels(prev => ({ ...prev, [key]: text }));
  };

  useEffect(() => {
    if (!selectedRegion) return setLabel('');
    setLabel(labels[selectedRegion.id] ?? '');
    setTimeout(() => {
      if (!labelInputElement.current) return;
      labelInputElement.current.focus();
    }, 0);
  }, [labels, selectedRegion]);

  const onDeleteLabel = (region) => {
    setSelectedRegion(null);
    region.remove();
  };

  useEffect(() => {
    const listener = debounce((e: WheelEvent) => {
      if (!['WAVE', 'REGION'].includes((e.target as HTMLElement)?.tagName)) return;
      if (!e.deltaY) return;
      const direction = Math.sign(e.deltaY) * -1;

      if (!ws.current) return;
      const newValue = Math.max(20, ws.current.params.minPxPerSec + 50 * direction);
      if (ws.current.params.minPxPerSec === newValue) return;
      ws.current.zoom(newValue);
    }, 100);
    document.addEventListener('wheel', listener);
    return () => document.removeEventListener('wheel', listener);
  }, []);

  const formattedRegions = `[\n${regions.map(r => `  [${r.start}, ${r.end}, ${JSON.stringify(labels[r.key] ?? '')}]`).join('\n')}\n]`;

  return (
    <>
      <div ref={wsElement}></div>
      <div ref={timelineElement}></div>
      <div ref={spectrogramElement}></div>
      <br/>
      {selectedRegion
        ? <p>
            Current: ({selectedRegion?.start}, {selectedRegion?.end})&nbsp;
            <button onClick={() => onDeleteLabel(selectedRegion)}>Delete</button>
            <br/>
            Label: <input ref={labelInputElement} value={label} onChange={e => onSetLabel(e.target.value)} readOnly={selectedRegion === null} />
          </p>
        : null
      }
      
      <p>Space = play / pause</p>
      <p>Mouse wheel = zoom</p>
      <p>Enter = start / end region</p>
      <textarea rows={20} cols={90} readOnly value={formattedRegions}/>
    </>
  );
}
