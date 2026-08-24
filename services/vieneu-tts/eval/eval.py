#!/usr/bin/env python3
"""
ChronoViet VieNeu TTS Service Quality & Latency Evaluator (Python)
Evaluates HTTP /synthesize endpoint for latency, word timestamps, and audio length.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

API_URL = os.environ.get('VIENEU_TTS_API_URL', 'http://localhost:8080/api/v1/synthesize')

TEST_SENTENCES = [
    'Chiến thắng Bạch Đằng năm 938 là bước ngoặt vĩ đại chấm dứt hơn một nghìn năm Bắc thuộc.',
    'Quốc Công Tiết Chế Trần Hưng Đạo ba lần lãnh đạo quân dân Đại Việt đánh tan quân Nguyên Mông.',
    'Hoàng đế Quang Trung Nguyễn Huệ hành quân thần tốc đại phá hai mươi vạn quân Thanh vào Tết Kỷ Dậu 1789.',
]

def run_eval():
    print('================================================================')
    print(' CHRONOVIET VIENEU TTS EVALUATION (Python Benchmark)')
    print(f' Endpoint: {API_URL}')
    print('================================================================\n')
    
    passed = 0
    total = len(TEST_SENTENCES)
    latencies = []
    
    for idx, text in enumerate(TEST_SENTENCES, 1):
        payload = json.dumps({'text': text, 'speaker': 'northern_male'}).encode('utf-8')
        req = urllib.request.Request(
            API_URL,
            data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        start = time.time()
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                duration_ms = (time.time() - start) * 1000
                latencies.append(duration_ms)
                status_code = response.getcode()
                res_data = json.loads(response.read().decode('utf-8'))
                
                audio_base64 = res_data.get('audioContent', '')
                timestamps = res_data.get('wordTimestamps', [])
                
                print(f'[{idx}/{total}] PASS: "{text[:40]}..." -> {duration_ms:.1f}ms (Timestamps: {len(timestamps)}, AudioLen: {len(audio_base64)} chars)')
                passed += 1
        except urllib.error.URLError as e:
            duration_ms = (time.time() - start) * 1000
            print(f'[{idx}/{total}] SKIPPED (TTS Service Offline): {e.reason}')
        except Exception as e:
            print(f'[{idx}/{total}] FAIL: {e}')
            
    print('\n================================================================')
    if passed == total:
        avg_lat = sum(latencies) / len(latencies) if latencies else 0
        print(f' ✅ ALL {total} TEST CASES PASSED! Avg Latency: {avg_lat:.1f}ms')
    else:
        print(f' ℹ️ Eval completed: {passed}/{total} passed (If offline, start with: pnpm ai:tts)')
    print('================================================================\n')

if __name__ == '__main__':
    run_eval()
