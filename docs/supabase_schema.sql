-- ============================================================
-- QUINIELA MUNDIAL 2026 - Supabase Database Schema
-- Version: 1.0.0 (MVP)
-- Compatible con: Supabase SQL Editor
-- Fecha: Junio 2026
-- ============================================================
-- INSTRUCCIONES:
-- 1. Abrir el SQL Editor de Supabase
-- 2. Copiar y ejecutar cada sección por separado
-- 3. Ejecutar en orden: SECCION 1 -> 2 -> 3 -> 4 -> 5
-- ============================================================

-- ============================================================
-- SECCION 1: CREACION DE TABLAS
-- ============================================================

-- 1.1 TEAMS - 48 selecciones del Mundial
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_es TEXT NOT NULL,
    name_en TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    group_name TEXT NOT NULL,
    flag_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_teams_group ON teams(group_name);

-- 1.2 PROFILES - Extiende auth.users de Supabase
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    preferred_language TEXT DEFAULT 'es' CHECK (preferred_language IN ('es', 'en')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.3 MATCHES - 104 partidos del Mundial
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_number INTEGER NOT NULL UNIQUE,
    home_team_id UUID REFERENCES teams(id),
    away_team_id UUID REFERENCES teams(id),
    home_team_label TEXT,
    away_team_label TEXT,
    match_date TIMESTAMPTZ NOT NULL,
    home_score INTEGER CHECK (home_score >= 0),
    away_score INTEGER CHECK (away_score >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'finished')),
    phase TEXT NOT NULL DEFAULT 'group' CHECK (phase IN (
        'group', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final'
    )),
    group_name TEXT,
    stadium TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT different_teams CHECK (
        (home_team_id IS NOT NULL AND away_team_id IS NOT NULL AND home_team_id != away_team_id)
        OR (home_team_id IS NULL OR away_team_id IS NULL)
    )
);

CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_phase ON matches(phase);
CREATE INDEX idx_matches_group ON matches(group_name);

-- 1.4 PREDICTIONS - Pronosticos de usuarios
CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    home_score INTEGER NOT NULL CHECK (home_score >= 0),
    away_score INTEGER NOT NULL CHECK (away_score >= 0),
    points_earned INTEGER DEFAULT 0 CHECK (points_earned IN (0, 1, 3)),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_match_prediction UNIQUE (user_id, match_id)
);

CREATE INDEX idx_predictions_user ON predictions(user_id);
CREATE INDEX idx_predictions_match ON predictions(match_id);
CREATE INDEX idx_predictions_points ON predictions(points_earned);

-- 1.5 LEADERBOARD CACHE - Tabla de posiciones (cache)
CREATE TABLE leaderboard_cache (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    total_points INTEGER DEFAULT 0,
    exact_predictions INTEGER DEFAULT 0,
    correct_tendencies INTEGER DEFAULT 0,
    total_predictions INTEGER DEFAULT 0,
    rank INTEGER,
    last_updated TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- SECCION 2: FUNCIONES Y TRIGGERS
-- ============================================================

-- 2.1 Calcular puntos de una prediccion
CREATE OR REPLACE FUNCTION calculate_prediction_points()
RETURNS TRIGGER AS $$
DECLARE
    actual_home INTEGER;
    actual_away INTEGER;
    match_status TEXT;
    predicted_diff INTEGER;
    actual_diff INTEGER;
    predicted_winner INTEGER;
    actual_winner INTEGER;
BEGIN
    SELECT m.home_score, m.away_score, m.status
    INTO actual_home, actual_away, match_status
    FROM matches m
    WHERE m.id = NEW.match_id;

    IF match_status = 'finished' AND actual_home IS NOT NULL AND actual_away IS NOT NULL THEN
        predicted_diff := NEW.home_score - NEW.away_score;
        actual_diff := actual_home - actual_away;

        IF NEW.home_score = actual_home AND NEW.away_score = actual_away THEN
            NEW.points_earned := 3;
        ELSE
            predicted_winner := CASE
                WHEN predicted_diff > 0 THEN 1
                WHEN predicted_diff < 0 THEN -1
                ELSE 0
            END;
            actual_winner := CASE
                WHEN actual_diff > 0 THEN 1
                WHEN actual_diff < 0 THEN -1
                ELSE 0
            END;

            IF predicted_winner = actual_winner THEN
                NEW.points_earned := 1;
            ELSE
                NEW.points_earned := 0;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.2 Validar que la prediccion se haga antes del partido
CREATE OR REPLACE FUNCTION validate_prediction_time()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM matches
        WHERE id = NEW.match_id
        AND (match_date <= now() OR status != 'pending')
    ) THEN
        RAISE EXCEPTION 'No se pueden modificar predicciones despues de que el partido haya comenzado';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.3 Actualizar leaderboard cache
CREATE OR REPLACE FUNCTION update_leaderboard_cache()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM leaderboard_cache;

    INSERT INTO leaderboard_cache (user_id, username, total_points, exact_predictions, correct_tendencies, total_predictions, rank)
    SELECT
        p.user_id,
        COALESCE(pr.username, 'Usuario'),
        SUM(p.points_earned) AS total_points,
        COUNT(*) FILTER (WHERE p.points_earned = 3) AS exact_predictions,
        COUNT(*) FILTER (WHERE p.points_earned = 1) AS correct_tendencies,
        COUNT(*) AS total_predictions,
        ROW_NUMBER() OVER (ORDER BY SUM(p.points_earned) DESC) AS rank
    FROM predictions p
    LEFT JOIN profiles pr ON pr.id = p.user_id
    GROUP BY p.user_id, pr.username
    ORDER BY total_points DESC;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2.4 Cambiar estado a 'live' cuando comienza el partido
CREATE OR REPLACE FUNCTION set_match_live()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.match_date <= now() AND NEW.status = 'pending' THEN
        NEW.status := 'live';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.5 Forzar bloqueo para match ya iniciado (a nivel BD)
CREATE OR REPLACE FUNCTION force_match_lock()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM matches
        WHERE id = NEW.match_id
        AND match_date <= now()
    ) THEN
        RAISE EXCEPTION 'Prediccion bloqueada: el partido ya comenzo';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS
DROP TRIGGER IF EXISTS trigger_calculate_points ON predictions;
CREATE TRIGGER trigger_calculate_points
    BEFORE INSERT OR UPDATE ON predictions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_prediction_points();

DROP TRIGGER IF EXISTS trigger_validate_prediction_time ON predictions;
CREATE TRIGGER trigger_validate_prediction_time
    BEFORE INSERT OR UPDATE ON predictions
    FOR EACH ROW
    EXECUTE FUNCTION force_match_lock();

DROP TRIGGER IF EXISTS trigger_update_leaderboard ON predictions;
CREATE TRIGGER trigger_update_leaderboard
    AFTER INSERT OR UPDATE OR DELETE ON predictions
    FOR EACH STATEMENT
    EXECUTE FUNCTION update_leaderboard_cache();

DROP TRIGGER IF EXISTS trigger_auto_live ON matches;
CREATE TRIGGER trigger_auto_live
    BEFORE UPDATE ON matches
    FOR EACH ROW
    WHEN (OLD.status = 'pending')
    EXECUTE FUNCTION set_match_live();


-- ============================================================
-- SECCION 3: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;

-- POLITICAS RLS

-- TEAMS: Todos pueden leer
CREATE POLICY "teams_select_all"
    ON teams FOR SELECT
    USING (true);

-- PROFILES: Todos pueden leer, cada quien edita el suyo
CREATE POLICY "profiles_select_all"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "profiles_insert_own"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- MATCHES: Todos pueden leer
CREATE POLICY "matches_select_all"
    ON matches FOR SELECT
    USING (true);

-- PREDICTIONS: Solo el propietario
CREATE POLICY "predictions_select_own"
    ON predictions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "predictions_insert_own"
    ON predictions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "predictions_update_own"
    ON predictions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "predictions_delete_own"
    ON predictions FOR DELETE
    USING (auth.uid() = user_id);

-- LEADERBOARD: Todos pueden leer
CREATE POLICY "leaderboard_select_all"
    ON leaderboard_cache FOR SELECT
    USING (true);


-- ============================================================
-- SECCION 4: DATOS INICIALES - 48 EQUIPOS
-- ============================================================

-- GRUPO A
INSERT INTO teams (name_es, name_en, code, group_name) VALUES
('Mexico', 'Mexico', 'MEX', 'A'),
('Sudafrica', 'South Africa', 'RSA', 'A'),
('Corea del Sur', 'South Korea', 'KOR', 'A'),
('Republica Checa', 'Czech Republic', 'CZE', 'A');

-- GRUPO B
INSERT INTO teams (name_es, name_en, code, group_name) VALUES
('Canada', 'Canada', 'CAN', 'B'),
('Bosnia y Herzegovina', 'Bosnia and Herzegovina', 'BIH', 'B'),
('Qatar', 'Qatar', 'QAT', 'B'),
('Suiza', 'Switzerland', 'SUI', 'B');

-- GRUPO C
INSERT INTO teams (name_es, name_en, code, group_name) VALUES
('Brasil', 'Brazil', 'BRA', 'C'),
('Marruecos', 'Morocco', 'MAR', 'C'),
('Haiti', 'Haiti', 'HAI', 'C'),
('Escocia', 'Scotland', 'SCO', 'C');

-- GRUPO D
INSERT INTO teams (name_es, name_en, code, group_name) VALUES
('Estados Unidos', 'United States', 'USA', 'D'),
('Paraguay', 'Paraguay', 'PAR', 'D'),
('Australia', 'Australia', 'AUS', 'D'),
('Turquia', 'Turkey', 'TUR', 'D');

-- GRUPO E
INSERT INTO teams (name_es, name_en, code, group_name) VALUES
('Alemania', 'Germany', 'GER', 'E'),
('Curacao', 'Curacao', 'CUR', 'E'),
('Costa de Marfil', 'Ivory Coast', 'CIV', 'E'),
('Ecuador', 'Ecuador', 'ECU', 'E');

-- GRUPO F
INSERT INTO teams (name_es, name_en, code, group_name) VALUES
('Paises Bajos', 'Netherlands', 'NED', 'F'),
('Japon', 'Japan', 'JPN', 'F'),
('Suecia', 'Sweden', 'SWE', 'F'),
('Tunez', 'Tunisia', 'TUN', 'F');

-- GRUPO G
INSERT INTO teams (name_es, name_en, code, group_name) VALUES
('Belgica', 'Belgium', 'BEL', 'G'),
('Egipto', 'Egypt', 'EGY', 'G'),
('Iran', 'Iran', 'IRN', 'G'),
('Nueva Zelanda', 'New Zealand', 'NZL', 'G');

-- GRUPO H
INSERT INTO teams (name_es, name_en, code, group_name) VALUES
('Espana', 'Spain', 'ESP', 'H'),
('Cabo Verde', 'Cape Verde', 'CPV', 'H'),
('Arabia Saudita', 'Saudi Arabia', 'KSA', 'H'),
('Uruguay', 'Uruguay', 'URU', 'H');

-- GRUPO I
INSERT INTO teams (name_es, name_en, code, group_name) VALUES
('Francia', 'France', 'FRA', 'I'),
('Senegal', 'Senegal', 'SEN', 'I'),
('Irak', 'Iraq', 'IRQ', 'I'),
('Noruega', 'Norway', 'NOR', 'I');

-- GRUPO J
INSERT INTO teams (name_es, name_en, code, group_name) VALUES
('Argentina', 'Argentina', 'ARG', 'J'),
('Argelia', 'Algeria', 'ALG', 'J'),
('Austria', 'Austria', 'AUT', 'J'),
('Jordania', 'Jordan', 'JOR', 'J');

-- GRUPO K
INSERT INTO teams (name_es, name_en, code, group_name) VALUES
('Portugal', 'Portugal', 'POR', 'K'),
('RD Congo', 'DR Congo', 'COD', 'K'),
('Uzbekistan', 'Uzbekistan', 'UZB', 'K'),
('Colombia', 'Colombia', 'COL', 'K');

-- GRUPO L
INSERT INTO teams (name_es, name_en, code, group_name) VALUES
('Inglaterra', 'England', 'ENG', 'L'),
('Croacia', 'Croatia', 'CRO', 'L'),
('Ghana', 'Ghana', 'GHA', 'L'),
('Panama', 'Panama', 'PAN', 'L');


-- ============================================================
-- SECCION 5: DATOS INICIALES - 104 PARTIDOS
-- ============================================================
-- NOTA: Las fechas estan en formato UTC.
-- Zonas horarias de cada estadio en Junio 2026 (horario de verano):
--   Pacifico (LA, SF, Seattle, Vancouver): UTC-7
--   Central (Dallas, Houston, KC, Mexico): UTC-5
--   Este (Toronto, Boston, NY, Philly, Atlanta, Miami): UTC-4
-- Las horas del calendario son hora LOCAL del estadio.
-- Formula: UTC = hora_local + abs(offset)
-- ============================================================

-- Helper: Obtener IDs de equipos por codigo
-- Se usaran subconsultas para mantener el script limpio

-- 5.1 FASE DE GRUPOS (72 partidos)

-- Jueves 11 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(1,  (SELECT id FROM teams WHERE code = 'MEX'), (SELECT id FROM teams WHERE code = 'RSA'), '2026-06-11T21:00:00Z', 'group', 'A', 'Estadio Azteca, Ciudad de Mexico'),
(2,  (SELECT id FROM teams WHERE code = 'KOR'), (SELECT id FROM teams WHERE code = 'CZE'), '2026-06-12T04:00:00Z', 'group', 'A', 'Estadio Akron, Guadalajara');

-- Viernes 12 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(3,  (SELECT id FROM teams WHERE code = 'CAN'), (SELECT id FROM teams WHERE code = 'BIH'), '2026-06-12T20:00:00Z', 'group', 'B', 'BMO Field, Toronto'),
(4,  (SELECT id FROM teams WHERE code = 'USA'), (SELECT id FROM teams WHERE code = 'PAR'), '2026-06-13T05:00:00Z', 'group', 'D', 'SoFi Stadium, Los Angeles');

-- Sabado 13 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(5,  (SELECT id FROM teams WHERE code = 'QAT'), (SELECT id FROM teams WHERE code = 'SUI'), '2026-06-13T23:00:00Z', 'group', 'B', 'Levis Stadium, San Francisco'),
(6,  (SELECT id FROM teams WHERE code = 'BRA'), (SELECT id FROM teams WHERE code = 'MAR'), '2026-06-13T23:00:00Z', 'group', 'C', 'MetLife Stadium, Nueva York'),
(7,  (SELECT id FROM teams WHERE code = 'HAI'), (SELECT id FROM teams WHERE code = 'SCO'), '2026-06-14T02:00:00Z', 'group', 'C', 'Gillette Stadium, Boston');

-- Domingo 14 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(8,  (SELECT id FROM teams WHERE code = 'AUS'), (SELECT id FROM teams WHERE code = 'TUR'), '2026-06-14T08:00:00Z', 'group', 'D', 'BC Place, Vancouver'),
(9,  (SELECT id FROM teams WHERE code = 'GER'), (SELECT id FROM teams WHERE code = 'CUR'), '2026-06-14T19:00:00Z', 'group', 'E', 'NRG Stadium, Houston'),
(10, (SELECT id FROM teams WHERE code = 'NED'), (SELECT id FROM teams WHERE code = 'JPN'), '2026-06-14T22:00:00Z', 'group', 'F', 'AT&T Stadium, Dallas'),
(11, (SELECT id FROM teams WHERE code = 'CIV'), (SELECT id FROM teams WHERE code = 'ECU'), '2026-06-15T00:00:00Z', 'group', 'E', 'Lincoln Financial Field, Filadelfia'),
(12, (SELECT id FROM teams WHERE code = 'SWE'), (SELECT id FROM teams WHERE code = 'TUN'), '2026-06-15T04:00:00Z', 'group', 'F', 'Estadio BBVA, Monterrey');

-- Lunes 15 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(13, (SELECT id FROM teams WHERE code = 'ESP'), (SELECT id FROM teams WHERE code = 'CPV'), '2026-06-15T17:00:00Z', 'group', 'H', 'Mercedes-Benz Stadium, Atlanta'),
(14, (SELECT id FROM teams WHERE code = 'BEL'), (SELECT id FROM teams WHERE code = 'EGY'), '2026-06-15T23:00:00Z', 'group', 'G', 'Lumen Field, Seattle'),
(15, (SELECT id FROM teams WHERE code = 'KSA'), (SELECT id FROM teams WHERE code = 'URU'), '2026-06-15T23:00:00Z', 'group', 'H', 'Hard Rock Stadium, Miami'),
(16, (SELECT id FROM teams WHERE code = 'IRN'), (SELECT id FROM teams WHERE code = 'NZL'), '2026-06-16T05:00:00Z', 'group', 'G', 'SoFi Stadium, Los Angeles');

-- Martes 16 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(17, (SELECT id FROM teams WHERE code = 'FRA'), (SELECT id FROM teams WHERE code = 'SEN'), '2026-06-16T20:00:00Z', 'group', 'I', 'MetLife Stadium, Nueva York'),
(18, (SELECT id FROM teams WHERE code = 'IRQ'), (SELECT id FROM teams WHERE code = 'NOR'), '2026-06-16T23:00:00Z', 'group', 'I', 'Gillette Stadium, Boston'),
(19, (SELECT id FROM teams WHERE code = 'ARG'), (SELECT id FROM teams WHERE code = 'ALG'), '2026-06-17T03:00:00Z', 'group', 'J', 'Arrowhead Stadium, Kansas City');

-- Miercoles 17 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(20, (SELECT id FROM teams WHERE code = 'AUT'), (SELECT id FROM teams WHERE code = 'JOR'), '2026-06-17T08:00:00Z', 'group', 'J', 'Levis Stadium, San Francisco'),
(21, (SELECT id FROM teams WHERE code = 'POR'), (SELECT id FROM teams WHERE code = 'COD'), '2026-06-17T19:00:00Z', 'group', 'K', 'NRG Stadium, Houston'),
(22, (SELECT id FROM teams WHERE code = 'ENG'), (SELECT id FROM teams WHERE code = 'CRO'), '2026-06-17T22:00:00Z', 'group', 'L', 'AT&T Stadium, Dallas'),
(23, (SELECT id FROM teams WHERE code = 'GHA'), (SELECT id FROM teams WHERE code = 'PAN'), '2026-06-18T00:00:00Z', 'group', 'L', 'BMO Field, Toronto'),
(24, (SELECT id FROM teams WHERE code = 'UZB'), (SELECT id FROM teams WHERE code = 'COL'), '2026-06-18T04:00:00Z', 'group', 'K', 'Estadio Azteca, Ciudad de Mexico');

-- Jueves 18 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(25, (SELECT id FROM teams WHERE code = 'CZE'), (SELECT id FROM teams WHERE code = 'RSA'), '2026-06-18T17:00:00Z', 'group', 'A', 'Mercedes-Benz Stadium, Atlanta'),
(26, (SELECT id FROM teams WHERE code = 'SUI'), (SELECT id FROM teams WHERE code = 'BIH'), '2026-06-18T23:00:00Z', 'group', 'B', 'SoFi Stadium, Los Angeles'),
(27, (SELECT id FROM teams WHERE code = 'CAN'), (SELECT id FROM teams WHERE code = 'QAT'), '2026-06-19T02:00:00Z', 'group', 'B', 'BC Place, Vancouver'),
(28, (SELECT id FROM teams WHERE code = 'MEX'), (SELECT id FROM teams WHERE code = 'KOR'), '2026-06-19T03:00:00Z', 'group', 'A', 'Estadio Akron, Guadalajara');

-- Viernes 19 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(29, (SELECT id FROM teams WHERE code = 'USA'), (SELECT id FROM teams WHERE code = 'AUS'), '2026-06-19T23:00:00Z', 'group', 'D', 'Lumen Field, Seattle'),
(30, (SELECT id FROM teams WHERE code = 'SCO'), (SELECT id FROM teams WHERE code = 'MAR'), '2026-06-19T23:00:00Z', 'group', 'C', 'Gillette Stadium, Boston'),
(31, (SELECT id FROM teams WHERE code = 'BRA'), (SELECT id FROM teams WHERE code = 'HAI'), '2026-06-20T01:30:00Z', 'group', 'C', 'Lincoln Financial Field, Filadelfia');

-- Sabado 20 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(32, (SELECT id FROM teams WHERE code = 'TUR'), (SELECT id FROM teams WHERE code = 'PAR'), '2026-06-20T07:00:00Z', 'group', 'D', 'Levis Stadium, San Francisco'),
(33, (SELECT id FROM teams WHERE code = 'NED'), (SELECT id FROM teams WHERE code = 'SWE'), '2026-06-20T19:00:00Z', 'group', 'F', 'NRG Stadium, Houston'),
(34, (SELECT id FROM teams WHERE code = 'GER'), (SELECT id FROM teams WHERE code = 'CIV'), '2026-06-20T21:00:00Z', 'group', 'E', 'BMO Field, Toronto'),
(35, (SELECT id FROM teams WHERE code = 'ECU'), (SELECT id FROM teams WHERE code = 'CUR'), '2026-06-21T02:00:00Z', 'group', 'E', 'Arrowhead Stadium, Kansas City');

-- Domingo 21 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(36, (SELECT id FROM teams WHERE code = 'TUN'), (SELECT id FROM teams WHERE code = 'JPN'), '2026-06-21T06:00:00Z', 'group', 'F', 'Estadio BBVA, Monterrey'),
(37, (SELECT id FROM teams WHERE code = 'ESP'), (SELECT id FROM teams WHERE code = 'KSA'), '2026-06-21T17:00:00Z', 'group', 'H', 'Mercedes-Benz Stadium, Atlanta'),
(38, (SELECT id FROM teams WHERE code = 'BEL'), (SELECT id FROM teams WHERE code = 'IRN'), '2026-06-21T23:00:00Z', 'group', 'G', 'SoFi Stadium, Los Angeles'),
(39, (SELECT id FROM teams WHERE code = 'URU'), (SELECT id FROM teams WHERE code = 'CPV'), '2026-06-21T23:00:00Z', 'group', 'H', 'Hard Rock Stadium, Miami'),
(40, (SELECT id FROM teams WHERE code = 'NZL'), (SELECT id FROM teams WHERE code = 'EGY'), '2026-06-22T05:00:00Z', 'group', 'G', 'BC Place, Vancouver');

-- Lunes 22 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(41, (SELECT id FROM teams WHERE code = 'ARG'), (SELECT id FROM teams WHERE code = 'AUT'), '2026-06-22T19:00:00Z', 'group', 'J', 'AT&T Stadium, Dallas'),
(42, (SELECT id FROM teams WHERE code = 'FRA'), (SELECT id FROM teams WHERE code = 'IRQ'), '2026-06-22T22:00:00Z', 'group', 'I', 'Lincoln Financial Field, Filadelfia'),
(43, (SELECT id FROM teams WHERE code = 'NOR'), (SELECT id FROM teams WHERE code = 'SEN'), '2026-06-23T01:00:00Z', 'group', 'I', 'MetLife Stadium, Nueva York');

-- Martes 23 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(44, (SELECT id FROM teams WHERE code = 'JOR'), (SELECT id FROM teams WHERE code = 'ALG'), '2026-06-23T07:00:00Z', 'group', 'J', 'Levis Stadium, San Francisco'),
(45, (SELECT id FROM teams WHERE code = 'POR'), (SELECT id FROM teams WHERE code = 'UZB'), '2026-06-23T19:00:00Z', 'group', 'K', 'NRG Stadium, Houston'),
(46, (SELECT id FROM teams WHERE code = 'ENG'), (SELECT id FROM teams WHERE code = 'GHA'), '2026-06-23T21:00:00Z', 'group', 'L', 'Gillette Stadium, Boston'),
(47, (SELECT id FROM teams WHERE code = 'PAN'), (SELECT id FROM teams WHERE code = 'CRO'), '2026-06-24T00:00:00Z', 'group', 'L', 'BMO Field, Toronto'),
(48, (SELECT id FROM teams WHERE code = 'COL'), (SELECT id FROM teams WHERE code = 'COD'), '2026-06-24T04:00:00Z', 'group', 'K', 'Estadio Akron, Guadalajara');

-- Miercoles 24 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(49, (SELECT id FROM teams WHERE code = 'SUI'), (SELECT id FROM teams WHERE code = 'CAN'), '2026-06-24T23:00:00Z', 'group', 'B', 'BC Place, Vancouver'),
(50, (SELECT id FROM teams WHERE code = 'BIH'), (SELECT id FROM teams WHERE code = 'QAT'), '2026-06-24T23:00:00Z', 'group', 'B', 'Lumen Field, Seattle'),
(51, (SELECT id FROM teams WHERE code = 'SCO'), (SELECT id FROM teams WHERE code = 'BRA'), '2026-06-24T23:00:00Z', 'group', 'C', 'Hard Rock Stadium, Miami'),
(52, (SELECT id FROM teams WHERE code = 'MAR'), (SELECT id FROM teams WHERE code = 'HAI'), '2026-06-24T23:00:00Z', 'group', 'C', 'Mercedes-Benz Stadium, Atlanta'),
(53, (SELECT id FROM teams WHERE code = 'CZE'), (SELECT id FROM teams WHERE code = 'MEX'), '2026-06-25T03:00:00Z', 'group', 'A', 'Estadio Azteca, Ciudad de Mexico'),
(54, (SELECT id FROM teams WHERE code = 'RSA'), (SELECT id FROM teams WHERE code = 'KOR'), '2026-06-25T03:00:00Z', 'group', 'A', 'Estadio BBVA, Monterrey');

-- Jueves 25 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(55, (SELECT id FROM teams WHERE code = 'CUR'), (SELECT id FROM teams WHERE code = 'CIV'), '2026-06-25T21:00:00Z', 'group', 'E', 'Lincoln Financial Field, Filadelfia'),
(56, (SELECT id FROM teams WHERE code = 'ECU'), (SELECT id FROM teams WHERE code = 'GER'), '2026-06-25T21:00:00Z', 'group', 'E', 'MetLife Stadium, Nueva York'),
(57, (SELECT id FROM teams WHERE code = 'JPN'), (SELECT id FROM teams WHERE code = 'SWE'), '2026-06-26T01:00:00Z', 'group', 'F', 'AT&T Stadium, Dallas'),
(58, (SELECT id FROM teams WHERE code = 'TUN'), (SELECT id FROM teams WHERE code = 'NED'), '2026-06-26T01:00:00Z', 'group', 'F', 'Arrowhead Stadium, Kansas City'),
(59, (SELECT id FROM teams WHERE code = 'TUR'), (SELECT id FROM teams WHERE code = 'USA'), '2026-06-26T06:00:00Z', 'group', 'D', 'SoFi Stadium, Los Angeles'),
(60, (SELECT id FROM teams WHERE code = 'PAR'), (SELECT id FROM teams WHERE code = 'AUS'), '2026-06-26T06:00:00Z', 'group', 'D', 'Levis Stadium, San Francisco');

-- Viernes 26 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(61, (SELECT id FROM teams WHERE code = 'NOR'), (SELECT id FROM teams WHERE code = 'FRA'), '2026-06-26T20:00:00Z', 'group', 'I', 'Gillette Stadium, Boston'),
(62, (SELECT id FROM teams WHERE code = 'SEN'), (SELECT id FROM teams WHERE code = 'IRQ'), '2026-06-26T20:00:00Z', 'group', 'I', 'BMO Field, Toronto'),
(63, (SELECT id FROM teams WHERE code = 'CPV'), (SELECT id FROM teams WHERE code = 'KSA'), '2026-06-27T02:00:00Z', 'group', 'H', 'NRG Stadium, Houston'),
(64, (SELECT id FROM teams WHERE code = 'URU'), (SELECT id FROM teams WHERE code = 'ESP'), '2026-06-27T02:00:00Z', 'group', 'H', 'Estadio Akron, Guadalajara');

-- Sabado 27 de junio
INSERT INTO matches (match_number, home_team_id, away_team_id, match_date, phase, group_name, stadium)
VALUES
(65, (SELECT id FROM teams WHERE code = 'EGY'), (SELECT id FROM teams WHERE code = 'IRN'), '2026-06-27T07:00:00Z', 'group', 'G', 'Lumen Field, Seattle'),
(66, (SELECT id FROM teams WHERE code = 'NZL'), (SELECT id FROM teams WHERE code = 'BEL'), '2026-06-27T07:00:00Z', 'group', 'G', 'BC Place, Vancouver'),
(67, (SELECT id FROM teams WHERE code = 'PAN'), (SELECT id FROM teams WHERE code = 'ENG'), '2026-06-27T22:00:00Z', 'group', 'L', 'MetLife Stadium, Nueva York'),
(68, (SELECT id FROM teams WHERE code = 'CRO'), (SELECT id FROM teams WHERE code = 'GHA'), '2026-06-27T22:00:00Z', 'group', 'L', 'Lincoln Financial Field, Filadelfia'),
(69, (SELECT id FROM teams WHERE code = 'COL'), (SELECT id FROM teams WHERE code = 'POR'), '2026-06-28T00:30:00Z', 'group', 'K', 'Hard Rock Stadium, Miami'),
(70, (SELECT id FROM teams WHERE code = 'COD'), (SELECT id FROM teams WHERE code = 'UZB'), '2026-06-28T00:30:00Z', 'group', 'K', 'Mercedes-Benz Stadium, Atlanta'),
(71, (SELECT id FROM teams WHERE code = 'ALG'), (SELECT id FROM teams WHERE code = 'AUT'), '2026-06-28T04:00:00Z', 'group', 'J', 'Arrowhead Stadium, Kansas City'),
(72, (SELECT id FROM teams WHERE code = 'JOR'), (SELECT id FROM teams WHERE code = 'ARG'), '2026-06-28T04:00:00Z', 'group', 'J', 'AT&T Stadium, Dallas');


-- 5.2 FASE ELIMINATORIA (32 partidos)
-- NOTA: equipos TBD (se actualizaran cuando se definan los clasificados)
-- Los labels describen los cruces

-- DIECISEISAVOS DE FINAL (Round of 32) - matches 73-88
INSERT INTO matches (match_number, home_team_label, away_team_label, match_date, phase, group_name, stadium)
VALUES
(73, '2° Grupo A', '2° Grupo B', '2026-06-28T22:00:00Z', 'round_of_32', NULL, 'SoFi Stadium, Los Angeles'),
(74, '1° Grupo C', '2° Grupo F', '2026-06-29T22:00:00Z', 'round_of_32', NULL, 'NRG Stadium, Houston'),
(75, '1° Grupo E', '3° Lugar', '2026-06-29T22:00:00Z', 'round_of_32', NULL, 'Gillette Stadium, Boston'),
(76, '1° Grupo F', '2° Grupo C', '2026-06-29T22:00:00Z', 'round_of_32', NULL, 'Estadio BBVA, Monterrey'),
(77, '2° Grupo E', '2° Grupo I', '2026-06-30T22:00:00Z', 'round_of_32', NULL, 'AT&T Stadium, Dallas'),
(78, '1° Grupo I', '3° Lugar', '2026-06-30T22:00:00Z', 'round_of_32', NULL, 'MetLife Stadium, Nueva York'),
(79, '1° Grupo A', '3° Lugar', '2026-06-30T22:00:00Z', 'round_of_32', NULL, 'Estadio Azteca, Ciudad de Mexico'),
(80, '1° Grupo L', '3° Lugar', '2026-07-01T22:00:00Z', 'round_of_32', NULL, 'Mercedes-Benz Stadium, Atlanta'),
(81, '1° Grupo G', '3° Lugar', '2026-07-01T22:00:00Z', 'round_of_32', NULL, 'Lumen Field, Seattle'),
(82, '1° Grupo D', '3° Lugar', '2026-07-01T22:00:00Z', 'round_of_32', NULL, 'Levis Stadium, San Francisco'),
(83, '1° Grupo H', '2° Grupo J', '2026-07-02T22:00:00Z', 'round_of_32', NULL, 'SoFi Stadium, Los Angeles'),
(84, '2° Grupo K', '2° Grupo L', '2026-07-02T22:00:00Z', 'round_of_32', NULL, 'BMO Field, Toronto'),
(85, '1° Grupo B', '3° Lugar', '2026-07-03T22:00:00Z', 'round_of_32', NULL, 'BC Place, Vancouver'),
(86, '2° Grupo D', '2° Grupo G', '2026-07-03T22:00:00Z', 'round_of_32', NULL, 'AT&T Stadium, Dallas'),
(87, '1° Grupo J', '2° Grupo H', '2026-07-03T22:00:00Z', 'round_of_32', NULL, 'Hard Rock Stadium, Miami'),
(88, '1° Grupo K', '3° Lugar', '2026-07-03T22:00:00Z', 'round_of_32', NULL, 'Arrowhead Stadium, Kansas City');

-- OCTAVOS DE FINAL (Round of 16) - matches 89-96
INSERT INTO matches (match_number, home_team_label, away_team_label, match_date, phase, group_name, stadium)
VALUES
(89, 'Ganador 73', 'Ganador 75', '2026-07-04T22:00:00Z', 'round_of_16', NULL, 'NRG Stadium, Houston'),
(90, 'Ganador 74', 'Ganador 77', '2026-07-04T22:00:00Z', 'round_of_16', NULL, 'Lincoln Financial Field, Filadelfia'),
(91, 'Ganador 76', 'Ganador 78', '2026-07-05T22:00:00Z', 'round_of_16', NULL, 'MetLife Stadium, Nueva York'),
(92, 'Ganador 79', 'Ganador 80', '2026-07-05T22:00:00Z', 'round_of_16', NULL, 'Estadio Azteca, Ciudad de Mexico'),
(93, 'Ganador 83', 'Ganador 84', '2026-07-06T22:00:00Z', 'round_of_16', NULL, 'AT&T Stadium, Dallas'),
(94, 'Ganador 81', 'Ganador 82', '2026-07-06T22:00:00Z', 'round_of_16', NULL, 'Lumen Field, Seattle'),
(95, 'Ganador 86', 'Ganador 88', '2026-07-07T22:00:00Z', 'round_of_16', NULL, 'Mercedes-Benz Stadium, Atlanta'),
(96, 'Ganador 85', 'Ganador 87', '2026-07-07T22:00:00Z', 'round_of_16', NULL, 'BC Place, Vancouver');

-- CUARTOS DE FINAL - matches 97-100
INSERT INTO matches (match_number, home_team_label, away_team_label, match_date, phase, group_name, stadium)
VALUES
(97, 'Ganador 89', 'Ganador 90', '2026-07-09T21:00:00Z', 'quarter', NULL, 'Gillette Stadium, Boston'),
(98, 'Ganador 93', 'Ganador 94', '2026-07-10T21:00:00Z', 'quarter', NULL, 'SoFi Stadium, Los Angeles'),
(99, 'Ganador 91', 'Ganador 92', '2026-07-11T21:00:00Z', 'quarter', NULL, 'Hard Rock Stadium, Miami'),
(100, 'Ganador 95', 'Ganador 96', '2026-07-11T21:00:00Z', 'quarter', NULL, 'Arrowhead Stadium, Kansas City');

-- SEMIFINALES - matches 101-102
INSERT INTO matches (match_number, home_team_label, away_team_label, match_date, phase, group_name, stadium)
VALUES
(101, 'Ganador 97', 'Ganador 98', '2026-07-14T21:00:00Z', 'semi', NULL, 'AT&T Stadium, Dallas'),
(102, 'Ganador 99', 'Ganador 100', '2026-07-15T21:00:00Z', 'semi', NULL, 'Mercedes-Benz Stadium, Atlanta');

-- TERCER PUESTO - match 103
INSERT INTO matches (match_number, home_team_label, away_team_label, match_date, phase, group_name, stadium)
VALUES
(103, 'Perdedor 101', 'Perdedor 102', '2026-07-18T17:00:00Z', 'third_place', NULL, 'Hard Rock Stadium, Miami');

-- GRAN FINAL - match 104
INSERT INTO matches (match_number, home_team_label, away_team_label, match_date, phase, group_name, stadium)
VALUES
(104, 'Ganador 101', 'Ganador 102', '2026-07-19T19:00:00Z', 'final', NULL, 'MetLife Stadium, Nueva York/Nueva Jersey');


-- ============================================================
-- SECCION 6: INDICES Y OPTIMIZACIONES
-- ============================================================

-- Indices compuestos para queries frecuentes
CREATE INDEX idx_predictions_user_match ON predictions(user_id, match_id);
CREATE INDEX idx_predictions_match_user ON predictions(match_id, user_id);
CREATE INDEX idx_matches_date_status ON matches(match_date, status);

-- Indice parcial para predicciones con puntos
CREATE INDEX idx_predictions_scored ON predictions(points_earned)
    WHERE points_earned > 0;

-- Indice para busqueda de texto en equipos
CREATE INDEX idx_teams_name_es ON teams(name_es);
CREATE INDEX idx_teams_name_en ON teams(name_en);
CREATE INDEX idx_teams_code ON teams(code);


-- ============================================================
-- SECCION 7: FUNCION PARA ACTUALIZAR EQUIPOS TBD
-- ============================================================

CREATE OR REPLACE FUNCTION update_knockout_team(
    p_match_number INTEGER,
    p_team_id UUID,
    p_is_home BOOLEAN
)
RETURNS VOID AS $$
BEGIN
    IF p_is_home THEN
        UPDATE matches
        SET home_team_id = p_team_id,
            home_team_label = (SELECT name_es FROM teams WHERE id = p_team_id)
        WHERE match_number = p_match_number;
    ELSE
        UPDATE matches
        SET away_team_id = p_team_id,
            away_team_label = (SELECT name_es FROM teams WHERE id = p_team_id)
        WHERE match_number = p_match_number;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- NOTAS FINALES
-- ============================================================
-- 1. Ejecutar SECCION 1 primero (crear tablas)
-- 2. Ejecutar SECCION 2 (funciones y triggers)
-- 3. Ejecutar SECCION 3 (RLS)
-- 4. Ejecutar SECCION 4 (equipos)
-- 5. Ejecutar SECCION 5 (partidos)
-- 6. Ejecutar SECCION 6 (indices)
-- 7. Ejecutar SECCION 7 (funcion para TBD)
--
-- Para actualizar equipos TBD en eliminatoria:
-- SELECT update_knockout_team(73, (SELECT id FROM teams WHERE code = 'XXX'), true);
-- ============================================================
