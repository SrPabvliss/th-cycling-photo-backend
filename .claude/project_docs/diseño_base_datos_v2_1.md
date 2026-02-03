# Database Schema - Cycling Photo Classification System

**PostgreSQL + Prisma ORM**  
**Version:** 2.1 (2026-01-20)

---

## ENUMs

```sql
CREATE TYPE event_status AS ENUM ('draft', 'uploading', 'processing', 'completed');

CREATE TYPE photo_status AS ENUM ('pending', 'detecting', 'analyzing', 'completed', 'failed');

CREATE TYPE unclassified_reason AS ENUM (
    'no_cyclist',       -- No cyclist detected
    'ocr_failed',       -- OCR failed to read plate
    'low_confidence',   -- Detection below threshold
    'processing_error'  -- Technical error
);

CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TYPE job_type AS ENUM ('detection', 'ocr', 'color_analysis');

CREATE TYPE processing_stage AS ENUM ('detection', 'ocr', 'color_analysis', 'completed');

CREATE TYPE equipment_item AS ENUM ('helmet', 'jersey', 'bike');
```

---

## Tables

### users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);
```

---

### events

```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    event_date DATE NOT NULL,
    location VARCHAR(200),
    status event_status NOT NULL DEFAULT 'draft',
    
    total_photos INTEGER DEFAULT 0,
    processed_photos INTEGER DEFAULT 0,
    exported_photos INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(event_date DESC);
```

---

### photos

```sql
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
    width INTEGER,
    height INTEGER,
    
    status photo_status NOT NULL DEFAULT 'pending',
    unclassified_reason unclassified_reason,
    
    captured_at TIMESTAMP WITH TIME ZONE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT unique_event_filename UNIQUE(event_id, filename),
    CONSTRAINT check_file_size CHECK (file_size > 0)
);

CREATE INDEX idx_photos_event_id ON photos(event_id);
CREATE INDEX idx_photos_status ON photos(status);
CREATE INDEX idx_photos_unclassified ON photos(event_id, unclassified_reason) 
    WHERE unclassified_reason IS NOT NULL;
```

---

### detected_cyclists

```sql
CREATE TABLE detected_cyclists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    
    bounding_box JSONB NOT NULL,  -- {"x1": 0.1, "y1": 0.2, "x2": 0.5, "y2": 0.8}
    confidence_score DECIMAL(5,4) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT check_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

CREATE INDEX idx_detected_cyclists_photo_id ON detected_cyclists(photo_id);
CREATE INDEX idx_detected_cyclists_confidence ON detected_cyclists(confidence_score DESC);
```

---

### plate_numbers

```sql
CREATE TABLE plate_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detected_cyclist_id UUID NOT NULL REFERENCES detected_cyclists(id) ON DELETE CASCADE,
    
    number INTEGER NOT NULL,  -- 1-999, NOT unique across events
    confidence_score DECIMAL(5,4),
    
    manually_corrected BOOLEAN DEFAULT FALSE,
    corrected_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT check_plate_number CHECK (number >= 1 AND number <= 999),
    CONSTRAINT unique_cyclist_plate UNIQUE(detected_cyclist_id)
);

CREATE INDEX idx_plate_numbers_number ON plate_numbers(number);
CREATE INDEX idx_plate_numbers_cyclist ON plate_numbers(detected_cyclist_id);
```

---

### equipment_colors

```sql
CREATE TABLE equipment_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detected_cyclist_id UUID NOT NULL REFERENCES detected_cyclists(id) ON DELETE CASCADE,
    
    item_type equipment_item NOT NULL,
    color_name VARCHAR(50) NOT NULL,
    color_hex VARCHAR(7) NOT NULL,
    density_percentage DECIMAL(5,2) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT check_density CHECK (density_percentage >= 0 AND density_percentage <= 100)
);

CREATE INDEX idx_equipment_colors_cyclist ON equipment_colors(detected_cyclist_id);
CREATE INDEX idx_equipment_colors_item_type ON equipment_colors(item_type);
CREATE INDEX idx_equipment_colors_name ON equipment_colors(color_name);
```

---

### processing_jobs

```sql
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    
    job_type job_type NOT NULL,
    status job_status NOT NULL DEFAULT 'pending',
    processing_stage processing_stage NOT NULL,
    
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT check_retry CHECK (retry_count >= 0 AND retry_count <= max_retries)
);

CREATE INDEX idx_processing_jobs_photo_id ON processing_jobs(photo_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_type ON processing_jobs(job_type);
```

---

## Relationships

```
events (1) ──→ (N) photos
photos (1) ──→ (N) detected_cyclists
photos (N) ──→ (1) processing_jobs

detected_cyclists (1) ──→ (0..1) plate_numbers
detected_cyclists (1) ──→ (N) equipment_colors
```

**Cascade deletes:** All child records deleted when parent is deleted.

---

## Key Decisions

- **Plate numbers:** NOT unique (reused across events, range 1-999)
- **Multiple cyclists/photo:** Supported, each cyclist is independent
- **Bounding box:** JSONB for Roboflow format flexibility
- **Colors:** Multiple per equipment item with density percentages
- **Processing:** Cascade flow: detection → (OCR + color_analysis in parallel)
- **No soft delete:** Real deletion only
