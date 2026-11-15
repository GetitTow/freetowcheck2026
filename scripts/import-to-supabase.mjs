#!/usr/bin/env node
/**
 * TowingSpecs — Supabase Import Script
 *
 * Usage: node scripts/import-to-supabase.mjs <path-to-json-file>
 *
 * Requirements:
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment.
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Error: Please provide path to JSON import file.');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function run() {
  const fileContent = readFileSync(filePath, 'utf-8');
  const payload = JSON.parse(fileContent);

  console.log(`Importing: ${payload.year} ${payload.make.name} ${payload.model.name}...`);

  // 1. Upsert Make
  const { data: make, error: makeErr } = await supabase
    .from('makes')
    .upsert({
      slug: payload.make.slug,
      name: payload.make.name,
      country_of_origin: payload.make.country_of_origin || null,
    }, { onConflict: 'slug' })
    .select()
    .single();

  if (makeErr) throw makeErr;

  // 2. Upsert Model
  const { data: model, error: modelErr } = await supabase
    .from('models')
    .upsert({
      make_id: make.id,
      slug: payload.model.slug,
      name: payload.model.name,
      body_style: payload.model.body_style || null,
    }, { onConflict: 'make_id,slug' })
    .select()
    .single();

  if (modelErr) throw modelErr;

  // 3. Upsert Model Year
  const { data: modelYear, error: myErr } = await supabase
    .from('model_years')
    .upsert({
      model_id: model.id,
      year: payload.year,
      is_published: true,
    }, { onConflict: 'model_id,year' })
    .select()
    .single();

  if (myErr) throw myErr;

  // 4. Trims & Configurations
  for (const trimData of payload.trims) {
    const { data: trim, error: trimErr } = await supabase
      .from('trims')
      .upsert({
        model_year_id: modelYear.id,
        name: trimData.name,
        slug: trimData.slug,
        msrp_usd: trimData.msrp_usd || null,
      }, { onConflict: 'model_year_id,slug' })
      .select()
      .single();

    if (trimErr) throw trimErr;

    for (const configData of trimData.configurations) {
      const { data: config, error: configErr } = await supabase
        .from('vehicle_configurations')
        .insert({
          trim_id: trim.id,
          engine_description: configData.engine_description || null,
          transmission: configData.transmission || null,
          drivetrain: configData.drivetrain || null,
          cab_style: configData.cab_style || null,
          bed_length: configData.bed_length || null,
          axle_ratio: configData.axle_ratio || null,
          has_tow_package: Boolean(configData.has_tow_package),
          configuration_notes: configData.configuration_notes || null,
        })
        .select()
        .single();

      if (configErr) throw configErr;

      // 5. Towing Spec
      const { data: spec, error: specErr } = await supabase
        .from('towing_specs')
        .insert({
          configuration_id: config.id,
          max_towing_capacity_lbs: configData.towing_spec.max_towing_capacity_lbs,
          max_tongue_weight_lbs: configData.towing_spec.max_tongue_weight_lbs || null,
          max_payload_lbs: configData.towing_spec.max_payload_lbs || null,
          gcwr_lbs: configData.towing_spec.gcwr_lbs || null,
          gvwr_lbs: configData.towing_spec.gvwr_lbs || null,
          curb_weight_lbs: configData.towing_spec.curb_weight_lbs || null,
          hitch_class: configData.towing_spec.hitch_class || null,
          equipment_notes: configData.towing_spec.equipment_notes || null,
        })
        .select()
        .single();

      if (specErr) throw specErr;

      // 6. Data Source & Link
      if (configData.source) {
        const { data: source, error: sourceErr } = await supabase
          .from('data_sources')
          .insert({
            source_type: configData.source.source_type,
            source_url: configData.source.source_url,
            document_title: configData.source.document_title,
            publisher: configData.source.publisher,
            publication_year: configData.source.publication_year || null,
            page_number: configData.source.page_number ? String(configData.source.page_number) : null,
            verification_status: 'manufacturer_verified',
            verification_date: configData.source.verification_date,
            verified_by: 'TowingSpecs Automated Importer',
          })
          .select()
          .single();

        if (sourceErr) throw sourceErr;

        await supabase.from('spec_source_links').insert({
          spec_id: spec.id,
          source_id: source.id,
          covers_fields: ['max_towing_capacity_lbs', 'max_payload_lbs', 'gcwr_lbs'],
        });
      }
    }
  }

  console.log('✓ Successfully imported vehicle configurations and specs.');
}

run().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
