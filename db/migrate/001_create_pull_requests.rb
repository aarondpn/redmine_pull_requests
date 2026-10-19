# frozen_string_literal: true

class CreatePullRequests < ActiveRecord::Migration[6.1]
  def change
    create_table :pull_requests do |t|
      t.string :provider, null: false, default: 'github', limit: 30
      t.string :repository, null: false
      t.integer :number, null: false
      t.string :url, null: false, limit: 1024
      t.string :title, limit: 1024
      t.string :state, null: false, default: 'open', limit: 30
      t.boolean :draft, null: false, default: false
      t.string :author_login
      t.string :author_avatar_url, limit: 1024
      t.string :merged_by_login
      t.string :head_ref
      t.string :base_ref
      t.integer :additions
      t.integer :deletions
      t.integer :changed_files
      t.integer :commits_count
      t.datetime :opened_at
      t.datetime :merged_at
      t.datetime :closed_at
      t.datetime :synced_at
      t.timestamps
    end
    add_index :pull_requests, [:provider, :repository, :number], unique: true, name: 'index_pull_requests_on_reference'
  end
end
