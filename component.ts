// COMPONENT SIDE CHANGES ONLY

// 1. ADD THESE IMPORTS:
import { ChangeDetectorRef } from '@angular/core';
import { filter, switchMap, delay } from 'rxjs';

// 2. UPDATE CONSTRUCTOR:
constructor(
  private srrService: SrrDataStomp,
  private cdr: ChangeDetectorRef  // ✅ ADD THIS
) {}

// 3. REPLACE YOUR ngOnInit() COMPLETELY:
ngOnInit(): void {
  console.log('[SRR Component] Initializing...');
  
  // Step 1: Start connection
  this.srrService.connect();
  
  // Step 2: Wait for connection, THEN subscribe
  this.srrService
    .getConnectionState()
    .pipe(
      takeUntil(this.destroy$),
      filter(isConnected => isConnected === true), // ✅ WAIT for connection
      delay(500), // ✅ ADD small delay to ensure connection is ready
      switchMap(() => {
        console.log('[SRR Component] Connection ready, subscribing...');
        return this.srrService.subscribeToTopic('/topic/messages');
      })
    )
    .subscribe({
      next: (data) => {
        console.log('[SRR Component] Received data:', data);
        this.handleMessage(data);
        this.cdr.detectChanges(); // ✅ TRIGGER change detection
      },
      error: (error) => {
        console.error('[SRR Component] Subscription error:', error);
      }
    });
}

// 4. ADD THIS NEW METHOD TO HANDLE MESSAGES:
private handleMessage(data: any): void {
  console.log('[SRR Component] Processing message:', data);
  
  if (data && typeof data === 'object' && Array.isArray(data)) {
    // Handle array of countries
    this.countriesArray = [...data];
    this.countriesSubject.next(this.countriesArray);
  } else if (data && typeof data === 'object') {
    // Handle single country update
    this.addOrUpdateCountry(data);
  }
  
  // ✅ FORCE UI update
  this.cdr.markForCheck();
}

// 5. FIX YOUR addOrUpdateCountry METHOD:
private addOrUpdateCountry(country: any): void {
  if (!country || !country.countryCode) {
    return;
  }

  const existingIndex = this.countriesArray.findIndex(c => c.countryCode === country.countryCode);
  
  if (existingIndex >= 0) {
    // Update existing
    this.countriesArray[existingIndex] = { ...this.countriesArray[existingIndex], ...country };
  } else {
    // Add new
    this.countriesArray.push(country);
  }
  
  // ✅ UPDATE the subject
  this.countriesSubject.next([...this.countriesArray]);
  
  console.log('[SRR Component] Countries updated:', this.countriesArray.length);
}

// 6. ADD THESE PROPERTIES AT TOP OF CLASS:
private destroy$ = new Subject<void>();
private countriesSubject = new Subject<any[]>(); // ✅ ADD THIS if missing

// 7. FIX YOUR ngOnDestroy():
ngOnDestroy(): void {
  console.log('[SRR Component] Destroying component...');
  
  // ✅ PROPER cleanup order
  this.destroy$.next();
  this.destroy$.complete();
  
  if (this.subscription) {
    this.subscription.unsubscribe();
  }
  
  this.countriesSubject.complete();
}

// 8. ADD DEBUG METHOD (temporary):
public checkConnectionStatus(): void {
  console.log('[SRR Component] Connection status:', this.srrService.getConnectionState().value);
  console.log('[SRR Component] Countries array:', this.countriesArray);
}

// 9. IN YOUR TEMPLATE, ADD DEBUG INFO:
/* 
In your .html file, add this temporarily:

<div class="debug-info" style="background: #f0f0f0; padding: 10px; margin: 10px;">
  <h4>Debug Info:</h4>
  <p>Connection State: {{ srrService.getConnectionState() | async }}</p>
  <p>Countries Count: {{ countriesArray?.length || 0 }}</p>
  <button (click)="checkConnectionStatus()">Check Status</button>
  <button (click)="srrService.connect()">Reconnect</button>
</div>

<div *ngFor="let country of countriesArray">
  <p>{{ country.countryCode }} - {{ country | json }}</p>
</div>
*/
