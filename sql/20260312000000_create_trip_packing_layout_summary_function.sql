-- Create RPC function to get trip packing layout summary
-- This function returns a formatted summary of the packing layout for AI analysis
-- Used by post-trip-analysis Edge Function

CREATE OR REPLACE FUNCTION get_trip_packing_layout_summary(p_trip_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_summary TEXT := '';
    v_layout_record RECORD;
    v_items_record RECORD;
    v_layout_items TEXT[];
    v_item_desc TEXT;
    v_total_weight NUMERIC := 0;
    v_is_detailed BOOLEAN := FALSE;
    v_pos_label TEXT;
    v_weight_str TEXT;
    v_layer_str TEXT;
    v_layer_num INTEGER;
    v_suffix TEXT;
    v_per_layer INTEGER;
    layer_idx INTEGER;
BEGIN
    -- Check if trip has any layout records
    IF NOT EXISTS (
        SELECT 1 FROM trip_packing_layout 
        WHERE delivery_trip_id = p_trip_id 
        LIMIT 1
    ) THEN
        RETURN NULL;
    END IF;
    
    -- Build summary for each position (pallet/floor)
    FOR v_layout_record IN 
        SELECT 
            tpl.id,
            tpl.position_type,
            tpl.position_index,
            tpl.total_layers,
            tpl.notes
        FROM trip_packing_layout tpl
        WHERE tpl.delivery_trip_id = p_trip_id
        ORDER BY 
            CASE WHEN tpl.position_type = 'pallet' THEN 1 ELSE 2 END,
            tpl.position_index
    LOOP
        -- Calculate total weight for this position
        SELECT COALESCE(SUM(ti.quantity * COALESCE(p.weight_kg, 0)), 0)
        INTO v_total_weight
        FROM trip_packing_layout_items tpli
        JOIN delivery_trip_items ti ON tpli.delivery_trip_item_id = ti.id
        JOIN products p ON ti.product_id = p.id
        WHERE tpli.trip_packing_layout_id = v_layout_record.id;
        
        -- Format position label
        v_weight_str := '';
        v_layer_str := '';
        IF v_layout_record.position_type = 'pallet' THEN
            v_pos_label := 'พาเลท ' || v_layout_record.position_index;
        ELSE
            v_pos_label := 'บนพื้น ' || v_layout_record.position_index;
        END IF;
        
        IF v_total_weight > 0 THEN
            v_weight_str := ', ' || ROUND(v_total_weight::NUMERIC, 0) || 'kg';
        END IF;
        
        IF v_layout_record.total_layers > 1 THEN
            v_layer_str := ', ' || v_layout_record.total_layers || ' ชั้น';
        END IF;
        
        -- Check if any items have layer_index (detailed mode)
        SELECT EXISTS(
            SELECT 1 FROM trip_packing_layout_items tpli
            WHERE tpli.trip_packing_layout_id = v_layout_record.id
            AND tpli.layer_index IS NOT NULL
            LIMIT 1
        ) INTO v_is_detailed;
        
        IF v_is_detailed AND v_layout_record.total_layers > 1 THEN
            -- Detailed mode: show items by layer
            v_summary := v_summary || '- ' || v_pos_label || v_weight_str || v_layer_str || ':' || E'\n';
            
            FOR layer_idx IN 0..GREATEST(v_layout_record.total_layers - 1, 0) LOOP
                v_layout_items := ARRAY[]::TEXT[];
                
                FOR v_items_record IN 
                    SELECT 
                        p.product_name,
                        ti.quantity,
                        p.unit
                    FROM trip_packing_layout_items tpli
                    JOIN delivery_trip_items ti ON tpli.delivery_trip_item_id = ti.id
                    JOIN products p ON ti.product_id = p.id
                    WHERE tpli.trip_packing_layout_id = v_layout_record.id
                    AND tpli.layer_index = layer_idx
                LOOP
                    v_item_desc := v_items_record.product_name || ' ' || v_items_record.quantity || ' ' || v_items_record.unit;
                    v_layout_items := array_append(v_layout_items, v_item_desc);
                END LOOP;
                
                IF array_length(v_layout_items, 1) > 0 THEN
                    v_layer_num := layer_idx + 1;
                    v_suffix := '';
                    IF layer_idx = 0 THEN
                        v_suffix := ' (ล่างสุด)';
                    ELSIF layer_idx = v_layout_record.total_layers - 1 THEN
                        v_suffix := ' (บนสุด)';
                    END IF;
                    
                    v_summary := v_summary || '  ชั้น ' || v_layer_num || v_suffix || ': ' || array_to_string(v_layout_items, ' + ') || E'\n';
                END IF;
            END LOOP;
            
        ELSE
            -- Simple mode: show aggregated items
            v_layout_items := ARRAY[]::TEXT[];
            
            FOR v_items_record IN 
                SELECT 
                    p.product_name,
                    SUM(ti.quantity) as total_quantity,
                    p.unit
                FROM trip_packing_layout_items tpli
                JOIN delivery_trip_items ti ON tpli.delivery_trip_item_id = ti.id
                JOIN products p ON ti.product_id = p.id
                WHERE tpli.trip_packing_layout_id = v_layout_record.id
                GROUP BY p.product_name, p.unit
            LOOP
                v_item_desc := v_items_record.product_name || ' ' || v_items_record.total_quantity || ' ' || v_items_record.unit;
                
                -- Add per-layer estimate if single item and multiple layers
                IF array_length(v_layout_items, 1) IS NULL AND v_layout_record.total_layers > 1 THEN
                    v_per_layer := FLOOR(v_items_record.total_quantity / v_layout_record.total_layers);
                    v_item_desc := v_item_desc || ' (ชั้นละ ~' || v_per_layer || ')';
                END IF;
                
                v_layout_items := array_append(v_layout_items, v_item_desc);
            END LOOP;
            
            IF array_length(v_layout_items, 1) > 0 THEN
                v_summary := v_summary || '- ' || v_pos_label || v_weight_str || v_layer_str || ': ' || array_to_string(v_layout_items, ' + ') || E'\n';
            END IF;
        END IF;
    END LOOP;
    
    -- Trim trailing newline if exists
    IF v_summary != '' THEN
        v_summary := rtrim(v_summary, E'\n');
    END IF;
    
    RETURN v_summary;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_trip_packing_layout_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_trip_packing_layout_summary TO service_role;
